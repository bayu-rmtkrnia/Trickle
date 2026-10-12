import { describe, expect, it } from 'vitest'
import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  listBankAccounts,
  normalizeAccountNumber,
  updateBankAccount,
} from '@/lib/api/bank-accounts'

const base = 'http://api.test/api/v1'
const dto = {
  id: 'bank-1',
  bankCode: 'BCA',
  accountName: 'Sari Wulandari',
  label: 'Rekening utama',
  accountNumberLast4: '0123',
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
}

function capture(response: () => Response) {
  const requests: Request[] = []
  return {
    requests,
    options: {
      baseUrl: base,
      fetcher: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(url, init))
        return response()
      },
    },
  }
}

describe('bank account adapter', () => {
  it('lists with a Trickle bearer and encodes the cursor once', async () => {
    const { requests, options } = capture(() => Response.json({ data: [dto], nextCursor: 'n2' }))
    const page = await listBankAccounts('session', 'a/b c', options)
    expect(requests[0]?.url).toBe(`${base}/bank-accounts?cursor=a%2Fb+c`)
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer session')
    expect(page).toEqual({ data: [dto], nextCursor: 'n2' })
  })

  it('omits the cursor on the first page', async () => {
    const { requests, options } = capture(() => Response.json({ data: [], nextCursor: null }))
    await listBankAccounts('session', undefined, options)
    expect(requests[0]?.url).toBe(`${base}/bank-accounts`)
  })

  it.each([
    { ...dto, accountNumberLast4: '12345' },
    { ...dto, accountNumberLast4: 'abcd' },
    { ...dto, bankCode: 'JAGO' },
    { ...dto, label: '' },
    { ...dto, createdAt: 'yesterday' },
    { ...dto, id: '' },
  ])('rejects a malformed or unmasked DTO %#', async (bad) => {
    const { options } = capture(() => Response.json({ data: [bad], nextCursor: null }))
    await expect(listBankAccounts('s', undefined, options)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('posts the number as a string so leading zeros survive', async () => {
    const { requests, options } = capture(() => Response.json(dto, { status: 201 }))
    await createBankAccount(
      { bankCode: 'BCA', accountNumber: '0012345678', accountName: 'Sari', label: null },
      'session',
      options,
    )
    expect(requests[0]?.method).toBe('POST')
    expect(await requests[0]?.json()).toEqual({
      bankCode: 'BCA',
      accountNumber: '0012345678',
      accountName: 'Sari',
      label: null,
    })
  })

  it('does not replay a mutation rejected with 401', async () => {
    const { requests, options } = capture(() =>
      Response.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }),
    )
    await expect(
      createBankAccount(
        { bankCode: 'BNI', accountNumber: '123456', accountName: 'Sari' },
        'session',
        options,
      ),
    ).rejects.toMatchObject({ status: 401 })
    expect(requests).toHaveLength(1)
  })

  it.each([
    [409, 'BANK_ACCOUNT_EXISTS'],
    [409, 'BANK_ACCOUNT_LIMIT'],
    [503, 'BANK_ACCOUNTS_UNAVAILABLE'],
  ])('keeps backend error %i %s for the UI', async (status, code) => {
    const { options } = capture(() => Response.json({ error: { code, message: 'x' } }, { status }))
    await expect(
      createBankAccount(
        { bankCode: 'BRI', accountNumber: '123456', accountName: 'Sari' },
        's',
        options,
      ),
    ).rejects.toMatchObject({ status, code })
  })

  it('reads, renames and deletes one account by encoded id', async () => {
    const get = capture(() => Response.json(dto))
    await getBankAccount('id/1', 's', get.options)
    expect(get.requests[0]?.url).toBe(`${base}/bank-accounts/id%2F1`)

    const patch = capture(() => Response.json({ ...dto, label: null }))
    const updated = await updateBankAccount('bank-1', { label: null }, 's', patch.options)
    expect(patch.requests[0]?.method).toBe('PATCH')
    expect(await patch.requests[0]?.json()).toEqual({ label: null })
    expect(updated.label).toBeNull()

    const remove = capture(() => new Response(null, { status: 204 }))
    await expect(deleteBankAccount('bank-1', 's', remove.options)).resolves.toBeUndefined()
    expect(remove.requests[0]?.method).toBe('DELETE')
  })

  it.each([
    ['1234 5678-90', '1234567890'],
    ['000123', '000123'],
    ['12345678901234567890', '12345678901234567890'],
    ['12345', null],
    ['123456789012345678901', null],
    ['12a456', null],
    ['', null],
  ])('normalizes account number %j', (raw, expected) => {
    expect(normalizeAccountNumber(raw)).toBe(expected)
  })
})
