'use client'

import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { PersonCard } from '@/components/ui/person-card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, badgeIcons } from '@/components/ui/status-badge'
import { isApiError } from '@/lib/api/errors'
import { invitationCopy, invitationError } from '@/lib/copy/family'
import { useLocale } from '@/lib/i18n/client'
import { formatDateShort } from '@/lib/format'
import { useFamilyInvitation } from './use-family-invitation'

export function FamilyInvitation({ code }: { code: string }) {
  const { locale } = useLocale()
  const t = invitationCopy[locale]
  const {
    account,
    session,
    identity,
    invite,
    loading,
    lookupError,
    actionError,
    phase,
    acceptedIdentity,
    retryUntil,
    loggingOut,
    reloadInvitation,
    login,
    logout,
    retryProfile,
    accept,
    recoverSession,
  } = useFamilyInvitation(code)

  if (loading)
    return (
      <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
        <span className="text-muted">{t.loading}</span>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20" />
        <Skeleton className="h-36" />
      </div>
    )
  if (lookupError || !invite) {
    const message = invitationError(lookupError, true, locale)
    return (
      <div className="flex flex-col gap-4">
        <InlineError variant="page" {...message} />
        <Button block onClick={reloadInvitation} disabled={retryUntil > 0}>
          {t.retry}
        </Button>
      </div>
    )
  }
  if (invite.type !== 'RECIPIENT')
    return (
      <InlineError
        variant="page"
        {...t.errors.worker}
        action={{ label: t.worker, href: `/w/invite/${encodeURIComponent(code)}` }}
      />
    )

  if (acceptedIdentity === identity && (phase === 'refresh-error' || phase === 'refreshing'))
    return (
      <div className="flex flex-col gap-4">
        {phase === 'refreshing' ? (
          <p role="status">{t.refreshing}</p>
        ) : (
          <>
            <InlineError title={t.success} message={t.successBody} />
            <Button block onClick={retryProfile}>
              {t.refreshProfile}
            </Button>
          </>
        )}
      </div>
    )

  const terminalCodes = [
    'INVITE_EXPIRED',
    'INVITE_REVOKED',
    'INVITE_ALREADY_ACCEPTED',
    'ALREADY_LINKED',
  ]
  const terminalError = isApiError(actionError) && terminalCodes.includes(actionError.code ?? '')
  if (invite.status !== 'PENDING' || terminalError) {
    const message = terminalError
      ? invitationError(actionError, false, locale)
      : invite.status === 'ACCEPTED'
        ? t.errors.used
        : invite.status === 'REVOKED'
          ? t.errors.revoked
          : t.errors.expired
    const dashboard =
      invite.status === 'ACCEPTED' ||
      (isApiError(actionError) &&
        ['INVITE_ALREADY_ACCEPTED', 'ALREADY_LINKED'].includes(actionError.code ?? ''))
    return (
      <InlineError
        variant="page"
        {...message}
        action={dashboard ? { label: t.dashboard, href: '/f' } : undefined}
      />
    )
  }

  const submitting = phase === 'accepting' || phase === 'refreshing'
  const error = actionError || session.error
  const errorCopy =
    isApiError(error) && error.code === 'LOGIN_FAILED'
      ? t.errors.login
      : isApiError(error) && error.code === 'LOGOUT_FAILED'
        ? t.errors.logout
        : invitationError(error, false, locale)
  const sessionBusy = session.status === 'exchanging' || session.status === 'loading'
  const needsRecovery = isApiError(actionError) && actionError.status === 401

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl/8 font-bold">{t.title}</h1>
        <p className="mt-2 text-muted">{t.intro}</p>
      </div>
      <StatusBadge tone="warn" icon={badgeIcons.clock}>
        {t.pending}
      </StatusBadge>
      <PersonCard name={invite.invitedBy.name ?? t.inviterFallback} />
      <PersonCard name={invite.inviteeName} subtitle={t.recipientLabel} />
      <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
        <p className="text-label text-muted">{t.relationLabel}</p>
        <p className="mt-1 text-2xl/8 font-bold text-brand-text">
          {invite.relation ?? t.relationUnavailable}
        </p>
        <p className="mt-4 text-label">
          {t.expiresLabel}: {formatDateShort(invite.expiresAt, locale)}
        </p>
      </div>
      {error && <InlineError {...errorCopy} />}
      {!account.configured ? (
        <InlineError {...t.errors.configuration} />
      ) : !account.ready ? (
        <p role="status">{t.accountLoading}</p>
      ) : !account.authenticated ? (
        <Button block onClick={login}>
          {t.login}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          {(account.user?.email || session.user?.displayName) && (
            <p className="break-all text-label text-muted">
              {t.signedInAs(account.user?.email ?? session.user!.displayName!)}
            </p>
          )}
          {phase === 'unknown' ? (
            <Button block onClick={reloadInvitation}>
              {t.checkStatus}
            </Button>
          ) : (
            <Button
              block
              onClick={accept}
              loading={submitting || sessionBusy}
              loadingLabel={submitting ? t.accepting : t.sessionLoading}
              disabled={loggingOut || retryUntil > 0 || session.status === 'error' || needsRecovery}
            >
              {t.accept}
            </Button>
          )}
          {(session.status === 'error' ||
            (isApiError(actionError) && actionError.status === 401)) && (
            <Button
              variant="secondary"
              block
              onClick={recoverSession}
              loading={submitting}
              loadingLabel={t.refreshing}
            >
              {t.refreshProfile}
            </Button>
          )}
          <Button
            variant="text"
            block
            onClick={logout}
            disabled={submitting}
            loading={loggingOut}
            loadingLabel={t.loggingOut}
          >
            {t.logout}
          </Button>
        </div>
      )}
    </div>
  )
}
