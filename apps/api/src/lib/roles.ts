/**
 * Roles are derived from relations on every check, never stored on the user,
 * so they cannot drift from the data: owning an active company makes you an employer,
 * an active employment (`Worker` row) makes you a worker, and being an active
 * `Recipient` of some worker makes you a recipient (family, PLAN §6.3 "R").
 */
export const ROLES = ['employer', 'worker', 'recipient'] as const

export type Role = (typeof ROLES)[number]
export type Roles = Record<Role, boolean>

/** Shape returned by `UserRepository.findWithRoleCounts`. */
export interface RoleRelations {
  /** Active (not soft-deleted) companies the user owns. */
  companies: { id: string }[]
  /** Both counts only include active (not soft-deleted) rows. */
  _count: { employments: number; recipientOf: number }
}

export const toRoles = (u: RoleRelations): Roles => ({
  employer: u.companies.length > 0,
  worker: u._count.employments > 0,
  recipient: u._count.recipientOf > 0,
})
