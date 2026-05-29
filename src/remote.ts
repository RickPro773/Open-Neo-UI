import { nanoid } from "nanoid"
import { q } from "./db"

const gen = () => `neo_${Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("base64url")}`

export async function createToken(userId:string, label:string): Promise<string> {
  const raw  = gen()
  const hash = await Bun.password.hash(raw, {algorithm:"bcrypt",cost:12})
  q.insertToken.run(nanoid(), hash, label||"Remote", userId)
  return raw
}

export async function verifyToken(raw:string): Promise<boolean> {
  if (!raw.startsWith("neo_")) return false
  for (const t of q.allTokens.all() as {id:string;token_hash:string}[]) {
    try { if (await Bun.password.verify(raw, t.token_hash)) { q.touchToken.run(t.id); return true } } catch {}
  }
  return false
}

export const getTokens = (uid:string) => q.getTokens.all(uid)
