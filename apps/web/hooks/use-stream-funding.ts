'use client'

import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { isMockMode, mockFunding, type Worker } from '@/lib/api'
import { requestGas } from '@/lib/api/gas'
import { useAccount } from '@/lib/account'
import { payrollConfig } from '@/lib/chain/config'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import {
  createFundingPort,
  createStreamFunder,
  fundingPlan,
  type FundingCall,
  type StreamFunder,
} from '@/lib/chain/stream-funder'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import { useSession } from '@/providers/session-provider'

export type FundingStep = 'preparing' | 'minting' | 'approving' | 'creating' | 'cancelling'
export type FundingState =
  | { phase: 'idle' }
  | { phase: 'working'; step: FundingStep }
  | { phase: 'success'; kind: 'fund' | 'cancel' }
  /** Ditolak sebelum/ saat dikirim; aman dicoba lagi. */
  | { phase: 'failed'; error: unknown }
  /** Sudah dikirim tapi hasilnya belum pasti; jangan kirim ulang, cek dashboard dulu. */
  | { phase: 'unknown'; error: unknown }

const IDLE: FundingState = { phase: 'idle' }

export interface FundRequest {
  worker: Worker
  units: bigint
  /** Detik Unix; `0` = mulai sekarang. */
  start: number
  end: number
}

/**
 * Mendanai gaji pekerja (mint uji bila perlu → approve → createStream) dan
 * menghentikan aliran (cancel), dari akun perusahaan yang sedang login. Satu proses
 * dalam satu waktu; state direset kalau akun berganti.
 */
export function useStreamFunding(onDone: () => void) {
  const account = useAccount()
  const session = useSession()
  const mock = isMockMode()
  const address = session.user?.address
  const wallet = address && isAddress(address) ? getAddress(address) : null
  const latest = useRef({ account, session, onDone })
  const [state, setState] = useState<FundingState>(IDLE)
  const busy = useRef(false)
  const active = useRef(true)

  useEffect(() => {
    latest.current = { account, session, onDone }
  })
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  // Akun lain tidak pernah mewarisi state proses akun sebelumnya.
  const identity = `${wallet ?? ''}:${account.user?.id ?? ''}:${session.user?.id ?? ''}`
  const [stateIdentity, setStateIdentity] = useState(identity)
  if (stateIdentity !== identity) {
    setStateIdentity(identity)
    setState(IDLE)
  }

  /** Masih akun yang sama, sesi siap, dan wallet Privy = alamat user di backend. */
  function current() {
    if (!active.current) return false
    if (mock) return true
    const { account: a, session: s } = latest.current
    return (
      !!wallet &&
      a.authenticated &&
      s.status === 'ready' &&
      a.walletAddress?.toLowerCase() === wallet.toLowerCase() &&
      s.user?.address.toLowerCase() === wallet.toLowerCase()
    )
  }
  function set(next: FundingState) {
    if (active.current) setState(next)
  }
  function funder(): StreamFunder {
    return createStreamFunder(
      createFundingPort(async (who, signal) => {
        const token = await latest.current.session.ensureSession()
        if (!token || !current()) throw new WithdrawalError('WALLET_CHANGED')
        return requestGas(token, who, { signal })
      }),
    )
  }

  /** Kirim satu transaksi lalu tunggu hasilnya. `sent` menandai sudah sampai ke wallet. */
  async function send(f: StreamFunder, call: FundingCall, sent: { value: boolean }): Promise<Hex> {
    const request = await f.prepare(call)
    if (!current()) throw new WithdrawalError('WALLET_CHANGED')
    sent.value = true
    const { hash } = await latest.current.account.sendTransaction(request)
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new WithdrawalError('INVALID_HASH')
    return hash
  }

  async function run(task: (sent: { value: boolean }) => Promise<void>, kind: 'fund' | 'cancel') {
    if (busy.current || !current()) return
    busy.current = true
    const sent = { value: false }
    try {
      await task(sent)
      set({ phase: 'success', kind })
      try {
        latest.current.onDone()
      } catch {
        // Transaksi sudah berhasil meski muat ulang dashboard gagal.
      }
    } catch (error) {
      // Setelah wallet diminta menandatangani, kegagalan yang tidak jelas bisa saja sudah terkirim.
      const unknown =
        sent.value &&
        !isRejected(error) &&
        !(error instanceof WithdrawalError && ['REVERTED', 'REPLACED'].includes(error.code))
      set(unknown ? { phase: 'unknown', error } : { phase: 'failed', error })
      if (unknown) latest.current.onDone()
    } finally {
      busy.current = false
    }
  }

  /** Danai gaji satu periode untuk satu pekerja. */
  function fund({ worker, units, start, end }: FundRequest) {
    return run(async (sent) => {
      if (mock) {
        set({ phase: 'working', step: 'preparing' })
        const plan = fundingPlan(units, await mockFunding.walletUnits(), BigInt(0), true)
        if (plan.mint !== null) {
          set({ phase: 'working', step: 'minting' })
          await mockFunding.mint(plan.mint)
        }
        set({ phase: 'working', step: 'approving' })
        await new Promise((r) => setTimeout(r, 500))
        set({ phase: 'working', step: 'creating' })
        await mockFunding.createStream(worker, units, start, end)
        return
      }

      const employer = wallet as Address
      const to = getAddress(worker.address)
      const f = funder()
      set({ phase: 'working', step: 'preparing' })
      await f.verify()
      const [balance, allowance] = await Promise.all([
        f.tokenBalance(employer),
        f.allowance(employer),
      ])
      const plan = fundingPlan(units, balance, allowance, payrollConfig.isMock)
      if (plan.mint !== null) {
        set({ phase: 'working', step: 'minting' })
        const call = { kind: 'mint', employer, units: plan.mint } as const
        await f.confirm(call, await send(f, call, sent))
      }
      if (plan.approve !== null) {
        set({ phase: 'working', step: 'approving' })
        const call = { kind: 'approve', employer, units: plan.approve } as const
        await f.confirm(call, await send(f, call, sent))
      }
      set({ phase: 'working', step: 'creating' })
      const call = { kind: 'create', employer, worker: to, units, start, end } as const
      await f.confirmCreate(call, await send(f, call, sent))
    }, 'fund')
  }

  /** Hentikan satu aliran; sisa dana yang belum mengalir kembali ke perusahaan. */
  function cancel(streamId: string) {
    return run(async (sent) => {
      set({ phase: 'working', step: 'cancelling' })
      if (mock) {
        await mockFunding.cancel(streamId)
        return
      }
      const f = funder()
      await f.verify()
      const call = {
        kind: 'cancel',
        employer: wallet as Address,
        streamId: BigInt(streamId),
      } as const
      await f.confirmCancel(call, await send(f, call, sent))
    }, 'cancel')
  }

  return {
    state,
    /** Bisa bertransaksi: akun dan sesi siap (atau mode pratinjau). */
    ready: mock || !!wallet,
    busy: state.phase === 'working',
    /** Saldo mAUSD uji di akun perusahaan, untuk ditampilkan di kartu dana. */
    walletAddress: wallet,
    fund,
    cancel,
    reset: () => set(IDLE),
  }
}
