import { randomInt } from 'node:crypto'

// No 0/O/1/I/L so codes survive being read aloud or typed from a screenshot.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function inviteCode(length = 10) {
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}
