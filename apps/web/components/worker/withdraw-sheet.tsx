import type { WithdrawalState } from '@/lib/chain/withdrawal-coordinator'
import type { StreamSnapshot } from '@/lib/chain/types'
import type { Hex } from 'viem'
import { useId, useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Field, inputClass } from '@/components/ui/field'
import { withdrawCopy as t } from '@/lib/copy/withdraw'
import { payrollConfig as config } from '@/lib/chain/config'
import { previewSplit, type Split } from '@/lib/chain/split'
import { availableAt } from '@/lib/chain/stream-math'
import { formatToken } from '@/lib/chain/format-token'
import { TransactionStatus } from './transaction-status'
export interface WithdrawSheetProps {
  open: boolean
  onClose(): void
  state: WithdrawalState
  streams: StreamSnapshot[]
  timestamp: bigint | null
  splits: readonly Split[]
  tokenSymbol: string
  walletAddress?: string | null
  select(id: bigint): void
  submit(): void
  resume(hash?: Hex): void
  abandon(): void
}
export function WithdrawSheet({
  open,
  onClose,
  state,
  streams,
  timestamp,
  splits,
  tokenSymbol,
  walletAddress,
  select,
  submit,
  resume,
  abandon,
}: WithdrawSheetProps) {
  const [recoveryHash, setRecoveryHash] = useState('')
  const inputId = useId()
  const recoveryWallet = walletAddress ?? streams[0]?.worker
  const stream = streams.find((s) => s.id === state.streamId)
  const gross = stream && timestamp !== null ? availableAt(stream, timestamp) : null
  const split = gross !== null ? previewSplit(gross, splits) : null
  const token = (value: bigint) => `${formatToken(value, config.tokenDecimals)} ${tokenSymbol}`
  const busy = state.checking || state.phase === 'signing' || state.phase === 'pending'
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.title}
      description={config.isMock ? t.demo : undefined}
      footer={
        <>
          {state.phase === 'confirming' && (
            <Button
              block
              onClick={submit}
              disabled={gross === null || gross === BigInt(0)}
              loading={state.checking}
              loadingLabel={t.preparing}
            >
              {t.confirm}
            </Button>
          )}
          {state.phase === 'failed' && state.streamId !== null && (
            <Button block onClick={() => select(state.streamId!)} disabled={timestamp === null}>
              {t.retry}
            </Button>
          )}
          {state.phase === 'unknown' && (
            <Button
              block
              onClick={() => (recoveryHash.trim() ? resume(recoveryHash.trim() as Hex) : resume())}
              loading={state.checking}
              loadingLabel={t.checking}
              disabled={
                recoveryHash.trim() ? !/^0x[0-9a-f]{64}$/i.test(recoveryHash.trim()) : !state.hash
              }
            >
              {t.check}
            </Button>
          )}
          {state.phase === 'unknown' && state.hash === null && (
            <Button
              block
              variant="secondary"
              onClick={abandon}
              loading={state.checking}
              loadingLabel={t.checking}
            >
              {t.verifyUnsent}
            </Button>
          )}
          <Button block variant="secondary" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {state.phase === 'idle' && (
          <>
            <p>{t.choose}</p>
            {streams
              .filter((s) => timestamp !== null && availableAt(s, timestamp) > BigInt(0))
              .map((s) => (
                <Button
                  key={s.id.toString()}
                  variant="secondary"
                  block
                  onClick={() => select(s.id)}
                >
                  {t.stream(s.id.toString())} — {token(availableAt(s, timestamp!))}
                </Button>
              ))}
            {streams.length === 0 && <p>{t.none}</p>}
          </>
        )}
        {state.phase === 'confirming' && (
          <>
            <p className="font-semibold">
              {state.streamId !== null ? t.stream(state.streamId.toString()) : t.choose}
            </p>
            {gross !== null && split ? (
              <>
                <dl className="flex flex-col gap-3">
                  <div>
                    <dt>{t.gross}</dt>
                    <dd className="break-all font-semibold tabular-nums">{token(gross)}</dd>
                  </div>
                  <div>
                    <dt>{t.worker}</dt>
                    <dd className="break-all font-semibold tabular-nums">
                      {token(split.toWorker)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.family}</dt>
                    <dd className="break-all font-semibold tabular-nums">
                      {token(split.toRecipients)}
                    </dd>
                  </div>
                  {split.shares.map((share, index) => (
                    <div key={share.recipient}>
                      <dt className="text-label text-muted">
                        {t.recipient(index + 1, share.recipient)}
                      </dt>
                      <dd className="break-all tabular-nums">{token(share.amount)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm/6 text-muted">{t.estimate}</p>
              </>
            ) : (
              <p>{t.stale}</p>
            )}
          </>
        )}
        {state.phase !== 'idle' && state.phase !== 'confirming' && (
          <TransactionStatus state={state} tokenSymbol={tokenSymbol} />
        )}
        {state.phase === 'unknown' && (
          <>
            {state.hash === null && <p className="text-sm/6 text-muted">{t.recoveryUnsent}</p>}
            <Field id={inputId} label={t.recoveryLabel} hint={t.recoveryHint}>
              <input
                id={inputId}
                aria-describedby={`${inputId}-hint`}
                className={inputClass()}
                value={recoveryHash}
                onChange={(e) => setRecoveryHash(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </Field>
            {recoveryWallet && (
              <a
                href={`${config.explorerUrl}/address/${recoveryWallet}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm/6 underline"
              >
                {t.recoveryExplorer}
              </a>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
