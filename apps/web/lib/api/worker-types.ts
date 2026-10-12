export interface UserDto {
  id: string
  address: string
  displayName: string | null
  createdAt: string
}

export interface Me extends UserDto {
  roles: {
    employer: boolean
    worker: boolean
    family: boolean
  }
}

export interface SessionResponse {
  token: string
  expiresAt: string
  user: UserDto
}
