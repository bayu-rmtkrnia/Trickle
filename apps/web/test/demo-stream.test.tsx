// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoStreamCard } from '@/components/worker/demo-stream-card'
import { ApiError } from '@/lib/api/errors'

const address = '0x2222222222222222222222222222222222222222'
const dto = {
  id: 'demo-1',
  workerAddress: address,
  amountUsd: '50',
  durationSeconds: 3600,
  status: 'SENT',
  streamId: '7',
  txHash: `0x${'a'.repeat(64)}`,
  startsAt: '2026-11-15T00:00:00Z',
  endsAt: '2026-11-15T01:00:00Z',
  alreadyStarted: false,
  createdAt: '2026-11-15T00:00:00Z',
}

const deps = vi.hoisted(() => ({ start: vi.fn() }))
vi.mock('@/lib/api/demo', async (original) => ({
  ...(await original<typeof import('@/lib/api/demo')>()),
  startDemoStream: (...args: unknown[]) => deps.start(...args),
}))

describe('demo stream card', () => {
  const session = { ensureSession: vi.fn(async () => 'token') }
  beforeEach(() => {
    deps.start.mockReset()
    session.ensureSession.mockClear()
  })
  afterEach(cleanup)

  it('starts the demo stream and asks the dashboard to reload streams', async () => {
    deps.start.mockResolvedValue(dto)
    const onStarted = vi.fn()
    render(<DemoStreamCard session={session} walletAddress={address} onStarted={onStarted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Coba gaji demo' }))
    await screen.findByText('Gaji demo sudah dimulai. Saldo akan muncul dalam beberapa detik.')
    expect(deps.start).toHaveBeenCalledWith('token', address)
    expect(onStarted).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Coba gaji demo' })).toBeNull()
  })

  it.each([
    [429, 'DEMO_IP_LIMIT', 'Batas demo hari ini tercapai'],
    [503, 'DEMO_UNAVAILABLE', 'Demo belum tersedia'],
    [502, 'DEMO_STREAM_FAILED', 'Gaji demo belum berhasil dimulai'],
  ])('explains a %i %s and lets the user retry', async (status, code, title) => {
    deps.start.mockRejectedValue(new ApiError('server', code, { status, code }))
    const onStarted = vi.fn()
    render(<DemoStreamCard session={session} walletAddress={address} onStarted={onStarted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Coba gaji demo' }))
    await screen.findByText(title)
    expect(onStarted).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Coba gaji demo' }).hasAttribute('disabled')).toBe(
        false,
      ),
    )
  })
})
