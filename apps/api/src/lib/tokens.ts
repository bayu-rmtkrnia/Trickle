import { createHash, randomBytes } from 'node:crypto'

/** Opaque bearer token handed to the client. Only its hash is stored. */
export const newSessionToken = () => randomBytes(32).toString('base64url')

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
