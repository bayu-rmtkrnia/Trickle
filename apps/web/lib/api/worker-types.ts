import type { Me } from './types'

export type { Me }

export interface UserDto {
  id: string
  address: string
  displayName: string | null
  createdAt: string
}

export interface SessionResponse {
  token: string
  expiresAt: string
  user: UserDto
}
