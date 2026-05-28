const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  let code = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length]
  }
  return `${code.slice(0, 2)}-${code.slice(2)}`
}

export async function generateRoomCode(db: D1Database): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode()
    const existing = await db.prepare('SELECT 1 FROM rooms WHERE code = ?').bind(code).first()
    if (!existing) return code
  }
  throw new Error('Could not generate unique room code after 10 attempts')
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{2}-[A-Z0-9]{4}$/.test(code)
}
