'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import type { SplitSettings } from '@/hooks/use-split-settings'
import type { RecipientDto } from '@/lib/api/recipients'
import { payrollConfig as config } from '@/lib/chain/config'
import { MAX_RECIPIENTS, bpsToPercent, type Split } from '@/lib/chain/split'
import { splitTxMessage, workerFamilyCopy } from '@/lib/copy/worker-family'
import { buildSplitDraft, type SplitRow } from '@/lib/split-form'

const t = workerFamilyCopy.splitSheet
const percentText = (bps: number) => bpsToPercent(bps).replace('.', ',')

export function SplitSheet({
  open,
  onClose,
  recipients,
  current,
  settings,
  worker,
}: {
  open: boolean
  onClose: () => void
  recipients: RecipientDto[]
  /** Active on-chain split; the form starts from it. */
  current: readonly Split[]
  settings: SplitSettings
  worker: string | null
}) {
  const formId = useId()
  const baseId = useId()
  const [rows, setRows] = useState<SplitRow[]>(() =>
    current.map(({ recipient, bps }) => ({ recipient, percent: percentText(bps) })),
  )
  const [submitted, setSubmitted] = useState(false)
  const { state } = settings
  const editing = ['idle', 'failed'].includes(state.phase)
  const busy = ['preparing', 'signing', 'pending'].includes(state.phase)
  const draft = buildSplitDraft(rows, worker ?? undefined)
  const errorFor = (index: number) => {
    if (!submitted || draft.ok) return undefined
    const code = draft.rows[index]
    return code ? (t.errors[code] ?? t.errors.percent) : undefined
  }
  const general = submitted && !draft.ok && draft.general ? t.errors[draft.general] : undefined
  const workerBps = Math.max(0, 10_000 - draft.totalBps)

  function update(index: number, patch: Partial<SplitRow>) {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  function submit() {
    setSubmitted(true)
    if (draft.ok) settings.save(draft.splits)
  }
  function close() {
    if (busy) return
    if (state.phase === 'success' || state.phase === 'failed') settings.reset()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? t.title : (t.phases[state.phase] ?? t.title)}
      description={t.description}
      footer={
        editing ? (
          <>
            <Button
              type="submit"
              form={formId}
              block
              disabled={!settings.ready || (rows.length > 0 && recipients.length === 0)}
            >
              {t.save}
            </Button>
            {current.length > 0 && (
              <Button variant="secondary" block onClick={() => settings.save([])}>
                {t.turnOff}
              </Button>
            )}
          </>
        ) : state.phase === 'unknown' ? (
          <>
            <Button block onClick={settings.recheck} disabled={!state.hash}>
              {t.recheck}
            </Button>
            <Button variant="secondary" block onClick={settings.reset}>
              {t.reset}
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            block
            onClick={close}
            loading={busy}
            loadingLabel={t.phases[state.phase]}
          >
            {t.close}
          </Button>
        )
      }
    >
      {editing ? (
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="flex flex-col gap-4"
        >
          {recipients.length === 0 && <p className="text-muted">{t.noRecipients}</p>}
          {rows.map((row, index) => {
            const error = errorFor(index)
            const selectId = `${baseId}-recipient-${index}`
            const percentId = `${baseId}-percent-${index}`
            return (
              <fieldset
                key={index}
                className="flex flex-col gap-3 rounded-xl border border-muted/30 p-4"
              >
                <legend className="px-1 text-label font-semibold">{t.recipient(index + 1)}</legend>
                <Field id={selectId} label={t.recipient(index + 1)} error={error}>
                  <select
                    id={selectId}
                    value={row.recipient}
                    onChange={(e) =>
                      update(index, { recipient: e.target.value as SplitRow['recipient'] })
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy(selectId, error)}
                    className={inputClass(Boolean(error))}
                  >
                    <option value="">{t.choose}</option>
                    {recipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.address}>
                        {recipient.displayName}
                        {recipient.relation ? ` (${recipient.relation})` : ''}
                      </option>
                    ))}
                    {row.recipient &&
                      !recipients.some(
                        (r) => r.address.toLowerCase() === row.recipient.toLowerCase(),
                      ) && (
                        <option value={row.recipient}>
                          {workerFamilyCopy.unnamed(row.recipient)}
                        </option>
                      )}
                  </select>
                </Field>
                <Field id={percentId} label={t.percent} hint={t.percentHint}>
                  <input
                    id={percentId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.percent}
                    onChange={(e) => update(index, { percent: e.target.value })}
                    aria-describedby={describedBy(percentId, undefined, true)}
                    className={`${inputClass()} tabular-nums`}
                  />
                </Field>
                <Button
                  variant="text"
                  onClick={() => setRows((list) => list.filter((_, i) => i !== index))}
                >
                  {t.removeRow}
                </Button>
              </fieldset>
            )
          })}
          {rows.length < MAX_RECIPIENTS && recipients.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setRows((list) => [...list, { recipient: '', percent: '' }])}
            >
              {t.add}
            </Button>
          )}
          <div className="text-label">
            <p className="font-semibold">{t.total(percentText(draft.totalBps))}</p>
            <p className="text-muted">{t.worker(percentText(workerBps))}</p>
          </div>
          {general && <InlineError title={general} />}
          {state.phase === 'failed' && state.error !== null && (
            <InlineError title={t.phases.failed!} message={splitTxMessage(state.error)} />
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-3" role="status">
          <StatusBadge tone={state.phase === 'success' ? 'success' : 'neutral'}>
            {t.phases[state.phase]}
          </StatusBadge>
          {state.phase === 'unknown' && <p className="text-label">{t.unknownBody}</p>}
          {state.phase === 'unknown' && state.error !== null && (
            <InlineError title={t.phases.unknown!} message={splitTxMessage(state.error)} />
          )}
          {state.hash && (
            <a
              href={`${config.explorerUrl}/tx/${state.hash}`}
              target="_blank"
              rel="noreferrer"
              className="text-label underline underline-offset-4"
            >
              {t.explorer}
            </a>
          )}
        </div>
      )}
    </Sheet>
  )
}
