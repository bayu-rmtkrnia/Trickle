/**
 * Roles are derived from relations on every check, never stored on the user,
 * so they cannot drift from the data: owning an active company makes you an employer,
 * an active employment (`Worker` row) makes you a worker, and so on.
 */
export const ROLES = ['employer', 'worker', 'family'] as const

export type Role = (typeof ROLES)[number]
export type Roles = Record<Role, boolean>

/** Shape returned by `UserRepository.findWithRoleCounts`. */
export interface RoleRelations {
  /** Active (not soft-deleted) companies the user owns. */
  companies: { id: string }[]
  /** `employments` counts only active `Worker` rows in active companies. */
  _count: { employments: number; familyAsRelative: number }
}

export const toRoles = (u: RoleRelations): Roles => ({
  employer: u.companies.length > 0,
  worker: u._count.employments > 0,
  family: u._count.familyAsRelative > 0,
})
