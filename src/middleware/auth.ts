import type { Context, Next } from "hono"
import { SignJWT, jwtVerify } from "jose"
import { queries } from "../db/database"

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-secret-change-in-production"
)

export interface SessionUser {
  id: string
  discord_id: string
  username: string
  avatar: string | null
  role: string
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

// Middleware — injeta o user no contexto se tiver sessão válida
export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, "session")

  if (token) {
    const user = await verifyToken(token)
    if (user) {
      c.set("user", user)
    }
  }

  await next()
}

// Middleware — redireciona para login se não autenticado
export async function requireAuth(c: Context, next: Next) {
  const user = c.get("user")
  if (!user) {
    // API requests retornam 401
    if (c.req.path.startsWith("/v1/") || c.req.path.startsWith("/api/")) {
      return c.json({ error: { message: "Unauthorized", type: "auth_error" } }, 401)
    }
    return c.redirect("/login")
  }
  await next()
}

// Helper para ler cookie
function getCookie(c: Context, name: string): string | undefined {
  const cookie = c.req.header("cookie") ?? ""
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

// Helper para setar cookie
export function setSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7 // 7 dias
  return `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}
