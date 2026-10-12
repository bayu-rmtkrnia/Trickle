export interface UserDto {
  id: string
  address: string
  displayName: string | null
  createdAt: string
}

export interface Me extends UserDto {
  /** Perusahaan aktif milik user; `null` kalau belum jadi employer. */
  companyId: string | null
  roles: {
    employer: boolean
    worker: boolean
    recipient: boolean
  }
}

export interface SessionResponse {
  token: string
  expiresAt: string
  user: UserDto
}
