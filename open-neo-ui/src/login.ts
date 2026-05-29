import { Hono } from "hono"
import { SignJWT, jwtVerify } from "jose"
import { nanoid } from "nanoid"
import type { Context, Next } from "hono"
import { q } from "./db"
import { sendVerificationEmail, sendPasswordResetEmail } from "./services/email"

// ── JWT ───────────────────────────────────────────────────────────────────────
const SECRET = new TextEncoder().encode(
  process.env["JWT_SECRET"] ?? "dev-secret-CHANGE-IN-PRODUCTION-min-32-chars!!"
)

export interface SessionUser {
  id: string; username: string; avatar: string | null
  role: string; provider: string; emailVerified?: boolean
}

export async function signToken(u: SessionUser): Promise<string> {
  return new SignJWT({ ...u })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET)
}

export async function verifyToken(t: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(t, SECRET)
    return payload as unknown as SessionUser
  } catch { return null }
}

function getCookie(c: Context, name: string): string | undefined {
  const h = c.req.header("cookie") ?? ""
  const m = h.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]!) : undefined
}

export const mkCookie  = (t: string) =>
  `neo_session=${encodeURIComponent(t)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
export const clrCookie = () =>
  `neo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`

function redir(loc: string, cookie?: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: loc, ...(cookie ? { "Set-Cookie": cookie } : {}) },
  })
}

// ── Middlewares ───────────────────────────────────────────────────────────────
export async function sessionMiddleware(c: Context, next: Next) {
  const t = getCookie(c, "neo_session")
  if (t) { const u = await verifyToken(t); if (u) c.set("user", u) }
  await next()
}

export async function requireAuth(c: Context, next: Next) {
  if (!c.get("user")) {
    const isApi = c.req.path.startsWith("/api/") || c.req.path.startsWith("/v1/")
    return isApi
      ? c.json({ error: "Unauthorized" }, 401)
      : c.redirect("/login")
  }
  await next()
}

// ── Upsert OAuth user ─────────────────────────────────────────────────────────
async function upsertOAuth(opts: {
  provider: string; provider_id: string; username: string
  email?: string | null; avatar?: string | null
}): Promise<any> {
  const n    = (q.countUsers.get() as { n: number }).n
  const role = n === 0 ? "admin" : "user"
  return q.upsertUser.get(
    nanoid(), opts.provider, opts.provider_id,
    opts.username, opts.email ?? null, opts.avatar ?? null, role
  )
}

// ── Auth routes ───────────────────────────────────────────────────────────────
export const authRoute = new Hono()

// ── EMAIL — Register ──────────────────────────────────────────────────────────
authRoute.get("/auth/register", c => {
  if (c.get("user")) return c.redirect("/")
  const err = c.req.query("error")
  const ok  = c.req.query("ok")
  return c.html(registerPage(err, ok))
})

authRoute.post("/auth/register", async c => {
  const body     = await c.req.parseBody()
  const email    = String(body["email"] ?? "").trim().toLowerCase()
  const username = String(body["username"] ?? "").trim()
  const password = String(body["password"] ?? "")
  const confirm  = String(body["confirm"] ?? "")

  if (!email || !username || !password)
    return c.redirect("/auth/register?error=fill_all")
  if (password.length < 8)
    return c.redirect("/auth/register?error=password_short")
  if (password !== confirm)
    return c.redirect("/auth/register?error=password_mismatch")

  // Email already exists?
  const existing = q.getUserByEmail.get(email) as any
  if (existing) return c.redirect("/auth/register?error=email_taken")

  const hash  = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })
  const id    = nanoid()
  const n     = (q.countUsers.get() as { n: number }).n
  const role  = n === 0 ? "admin" : "user"

  q.createEmailUser.run(id, "email", email, username, email, hash, 0, role)

  // Send verification email
  const token  = nanoid(32)
  const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24  // 24h
  q.insertVerifToken.run(nanoid(), id, token, expiry)
  await sendVerificationEmail(email, username, token)

  return c.redirect("/auth/register?ok=check_email")
})

// ── EMAIL — Login ─────────────────────────────────────────────────────────────
authRoute.post("/auth/email/login", async c => {
  const body     = await c.req.parseBody()
  const email    = String(body["email"] ?? "").trim().toLowerCase()
  const password = String(body["password"] ?? "")

  if (!email || !password) return c.redirect("/login?error=fill_all")

  const user = q.getUserByEmail.get(email) as any
  if (!user || !user.password_hash)
    return c.redirect("/login?error=invalid_credentials")

  const ok = await Bun.password.verify(password, user.password_hash)
  if (!ok) return c.redirect("/login?error=invalid_credentials")

  if (!user.email_verified)
    return c.redirect("/login?error=email_not_verified")

  q.updateLogin.run(user.id)
  const token = await signToken({
    id: user.id, username: user.username,
    avatar: user.avatar, role: user.role,
    provider: "email", emailVerified: true,
  })
  return redir("/", mkCookie(token))
})

// ── EMAIL — Verify ────────────────────────────────────────────────────────────
authRoute.get("/auth/verify-email", async c => {
  const token = c.req.query("token")
  if (!token) return c.redirect("/login?error=invalid_token")

  const row = q.getVerifToken.get(token) as any
  if (!row) return c.redirect("/login?error=token_expired")

  q.useVerifToken.run(row.id)
  q.verifyEmail.run(row.user_id)

  return c.redirect("/login?ok=email_verified")
})

// ── EMAIL — Forgot password ───────────────────────────────────────────────────
authRoute.get("/auth/forgot-password", c => {
  const ok  = c.req.query("ok")
  const err = c.req.query("error")
  return c.html(forgotPage(err, ok))
})

authRoute.post("/auth/forgot-password", async c => {
  const body  = await c.req.parseBody()
  const email = String(body["email"] ?? "").trim().toLowerCase()
  if (!email) return c.redirect("/auth/forgot-password?error=fill_email")

  const user = q.getUserByEmail.get(email) as any
  // Always redirect OK to prevent email enumeration
  if (user) {
    const token  = nanoid(32)
    const expiry = Math.floor(Date.now() / 1000) + 3600  // 1h
    q.insertResetToken.run(nanoid(), email, token, expiry)
    await sendPasswordResetEmail(email, token)
  }

  return c.redirect("/auth/forgot-password?ok=check_email")
})

// ── EMAIL — Reset password ────────────────────────────────────────────────────
authRoute.get("/auth/reset-password", c => {
  const token = c.req.query("token")
  if (!token) return c.redirect("/login?error=invalid_token")
  const err = c.req.query("error")
  return c.html(resetPage(token, err))
})

authRoute.post("/auth/reset-password", async c => {
  const body     = await c.req.parseBody()
  const token    = String(body["token"] ?? "")
  const password = String(body["password"] ?? "")
  const confirm  = String(body["confirm"] ?? "")

  if (password.length < 8)
    return c.redirect(`/auth/reset-password?token=${token}&error=password_short`)
  if (password !== confirm)
    return c.redirect(`/auth/reset-password?token=${token}&error=password_mismatch`)

  const row = q.getResetToken.get(token) as any
  if (!row) return c.redirect("/login?error=token_expired")

  const user = q.getUserByEmail.get(row.email) as any
  if (!user)  return c.redirect("/login?error=user_not_found")

  const hash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 })
  q.updatePassword.run(hash, user.id)
  q.useResetToken.run(row.id)

  return c.redirect("/login?ok=password_reset")
})

// ── DISCORD ───────────────────────────────────────────────────────────────────
authRoute.get("/auth/discord", c => {
  const id  = process.env["DISCORD_CLIENT_ID"]
  const uri = process.env["DISCORD_REDIRECT_URI"]
  if (!id || !uri) return c.text("DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI not set in .env", 500)
  const url = new URL("https://discord.com/oauth2/authorize")
  url.searchParams.set("client_id", id)
  url.searchParams.set("redirect_uri", uri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "identify email")
  return c.redirect(url.toString())
})

authRoute.get("/auth/discord/callback", async c => {
  const code  = c.req.query("code")
  const error = c.req.query("error")
  if (error || !code) return c.redirect("/login?error=discord_denied")

  try {
    // Exchange code → access token
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        client_id:     process.env["DISCORD_CLIENT_ID"]!,
        client_secret: process.env["DISCORD_CLIENT_SECRET"]!,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env["DISCORD_REDIRECT_URI"]!,
      }),
    })

    if (!tokenRes.ok) {
      const txt = await tokenRes.text()
      console.error("[auth/discord] token exchange failed:", txt)
      return c.redirect("/login?error=token_failed")
    }

    const { access_token } = await tokenRes.json() as { access_token: string }

    // Fetch Discord user
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userRes.ok) return c.redirect("/login?error=user_fetch_failed")

    const d = await userRes.json() as {
      id: string; username: string; global_name?: string
      avatar?: string; email?: string
    }

    const avatar = d.avatar
      ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(d.id) % 6}.png`

    const user = await upsertOAuth({
      provider:    "discord",
      provider_id: d.id,
      username:    d.global_name ?? d.username,
      email:       d.email,
      avatar,
    }) as any

    const jwt = await signToken({
      id: user.id, username: user.username,
      avatar: user.avatar, role: user.role, provider: "discord",
    })
    return redir("/", mkCookie(jwt))
  } catch (err) {
    console.error("[auth/discord]", err)
    return c.redirect("/login?error=server_error")
  }
})

// ── GITHUB ────────────────────────────────────────────────────────────────────
authRoute.get("/auth/github", c => {
  const id  = process.env["GITHUB_CLIENT_ID"]
  const uri = process.env["GITHUB_REDIRECT_URI"]
  if (!id || !uri) return c.text("GITHUB_CLIENT_ID / GITHUB_REDIRECT_URI not set in .env", 500)
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", id)
  url.searchParams.set("redirect_uri", uri)
  url.searchParams.set("scope", "read:user user:email")
  return c.redirect(url.toString())
})

authRoute.get("/auth/github/callback", async c => {
  const code  = c.req.query("code")
  const error = c.req.query("error")
  if (error || !code) return c.redirect("/login?error=github_denied")

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method:  "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body:    JSON.stringify({
        client_id:     process.env["GITHUB_CLIENT_ID"],
        client_secret: process.env["GITHUB_CLIENT_SECRET"],
        code,
        redirect_uri:  process.env["GITHUB_REDIRECT_URI"],
      }),
    })

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
    if (!tokenData.access_token || tokenData.error) {
      console.error("[auth/github] token error:", tokenData)
      return c.redirect("/login?error=token_failed")
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent":  "open-neo-ui/0.2.1",
        Accept:        "application/vnd.github.v3+json",
      },
    })
    if (!userRes.ok) return c.redirect("/login?error=user_fetch_failed")

    const g = await userRes.json() as {
      id: number; login: string; name?: string
      avatar_url: string; email?: string
    }

    // Fetch primary email separately if not in profile
    let email = g.email
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent":  "open-neo-ui/0.2.1",
          Accept:        "application/vnd.github.v3+json",
        },
      })
      if (emailRes.ok) {
        const emails = await emailRes.json() as { email: string; primary: boolean; verified: boolean }[]
        email = emails.find(e => e.primary && e.verified)?.email
              ?? emails.find(e => e.primary)?.email
      }
    }

    const user = await upsertOAuth({
      provider:    "github",
      provider_id: String(g.id),
      username:    g.name ?? g.login,
      email,
      avatar:      g.avatar_url,
    }) as any

    const jwt = await signToken({
      id: user.id, username: user.username,
      avatar: user.avatar, role: user.role, provider: "github",
    })
    return redir("/", mkCookie(jwt))
  } catch (err) {
    console.error("[auth/github]", err)
    return c.redirect("/login?error=server_error")
  }
})

// ── GOOGLE ────────────────────────────────────────────────────────────────────
authRoute.get("/auth/google", c => {
  const id  = process.env["GOOGLE_CLIENT_ID"]
  const uri = process.env["GOOGLE_REDIRECT_URI"]
  if (!id || !uri) return c.text("GOOGLE_CLIENT_ID / GOOGLE_REDIRECT_URI not set in .env", 500)
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", id)
  url.searchParams.set("redirect_uri", uri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email profile")
  url.searchParams.set("access_type", "online")
  url.searchParams.set("prompt", "select_account")
  return c.redirect(url.toString())
})

authRoute.get("/auth/google/callback", async c => {
  const code  = c.req.query("code")
  const error = c.req.query("error")
  if (error || !code) return c.redirect("/login?error=google_denied")

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        client_id:     process.env["GOOGLE_CLIENT_ID"]!,
        client_secret: process.env["GOOGLE_CLIENT_SECRET"]!,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env["GOOGLE_REDIRECT_URI"]!,
      }),
    })

    if (!tokenRes.ok) {
      const txt = await tokenRes.text()
      console.error("[auth/google] token exchange failed:", txt)
      return c.redirect("/login?error=token_failed")
    }

    const { access_token } = await tokenRes.json() as { access_token: string }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!userRes.ok) return c.redirect("/login?error=user_fetch_failed")

    const g = await userRes.json() as {
      id: string; name: string; email: string; picture: string
    }

    const user = await upsertOAuth({
      provider:    "google",
      provider_id: g.id,
      username:    g.name,
      email:       g.email,
      avatar:      g.picture,
    }) as any

    const jwt = await signToken({
      id: user.id, username: user.username,
      avatar: user.avatar, role: user.role, provider: "google",
    })
    return redir("/", mkCookie(jwt))
  } catch (err) {
    console.error("[auth/google]", err)
    return c.redirect("/login?error=server_error")
  }
})

// ── Logout ────────────────────────────────────────────────────────────────────
authRoute.get("/auth/logout", () => redir("/login", clrCookie()))

// ═════════════════════════════════════════════════════════════════════════════
// HTML pages (inline — keeps zero external files for auth)
// ═════════════════════════════════════════════════════════════════════════════

const CSS_BASE = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d1117;--s1:#161b22;--s2:#21262d;--s3:#2d333b;--bd:#30363d;--bd2:#444c56;--tx:#e6edf3;--tx2:#adbac7;--mu:#768390;--ac:#58a6ff;--ac2:#79c0ff;--gr:#3fb950;--rd:#f85149;--pu:#bc8cff;--ye:#d29922}
html,body{height:100%;background:var(--bg);color:var(--tx);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;position:relative;overflow:hidden}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(88,166,255,.1),transparent);pointer-events:none}
body::after{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(88,166,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(88,166,255,.03) 1px,transparent 1px);background-size:32px 32px;pointer-events:none}
.wrap{position:relative;z-index:1;width:100%;max-width:400px}
.logo-area{text-align:center;margin-bottom:24px}
.logo-box{display:inline-flex;width:56px;height:56px;align-items:center;justify-content:center;background:linear-gradient(135deg,#1c2128,#21262d);border:1px solid var(--bd);border-radius:14px;font-size:26px;margin-bottom:12px;box-shadow:0 0 40px rgba(88,166,255,.12),inset 0 1px 0 rgba(255,255,255,.04)}
.logo-name{font-size:22px;font-weight:800;letter-spacing:-.5px;color:var(--tx)}
.logo-ver{display:inline-block;margin-top:5px;font-size:11px;color:var(--mu);background:var(--s2);border:1px solid var(--bd);border-radius:20px;padding:2px 9px}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.section-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:var(--mu);margin-bottom:10px}
.divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--mu);font-size:12px}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--bd)}
.fg{margin-bottom:12px}
label.fl{display:block;font-size:12.5px;font-weight:600;color:var(--tx2);margin-bottom:5px}
.fi{width:100%;background:var(--s2);border:1px solid var(--bd);border-radius:7px;padding:9px 12px;color:var(--tx);font-size:13px;font-family:inherit;outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--ac)}
.fi::placeholder{color:var(--mu)}
.btn-p{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px;background:var(--ac);color:#0d1117;border:none;border-radius:7px;font-size:14px;font-weight:600;cursor:pointer;transition:background .12s,transform .1s;font-family:inherit}
.btn-p:hover{background:var(--ac2);transform:translateY(-1px)}
.btn-p:active{transform:translateY(0)}
.btn-auth{display:flex;align-items:center;gap:11px;width:100%;padding:10px 14px;border-radius:7px;border:1px solid var(--bd);background:var(--s2);color:var(--tx);font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:all .12s;margin-bottom:8px}
.btn-auth:hover{background:var(--s3);border-color:var(--bd2);transform:translateY(-1px)}
.btn-auth:active{transform:translateY(0)}
.btn-auth svg,.btn-auth img{width:18px;height:18px;flex-shrink:0}
.btn-discord{border-color:rgba(88,101,242,.3);background:rgba(88,101,242,.06)}
.btn-discord:hover{background:rgba(88,101,242,.13);border-color:rgba(88,101,242,.5)}
.btn-github:hover{border-color:rgba(240,246,252,.2)}
.btn-google{border-color:rgba(66,133,244,.2)}
.btn-google:hover{background:rgba(66,133,244,.08);border-color:rgba(66,133,244,.4)}
.alert{border-radius:7px;padding:10px 13px;font-size:13px;margin-bottom:14px;display:flex;gap:8px;align-items:flex-start;line-height:1.5}
.alert-err{background:rgba(248,81,73,.07);border:1px solid rgba(248,81,73,.2);color:#f85149}
.alert-ok{background:rgba(63,185,80,.07);border:1px solid rgba(63,185,80,.2);color:#3fb950}
.alert-info{background:rgba(88,166,255,.07);border:1px solid rgba(88,166,255,.18);color:var(--ac)}
.link{color:var(--ac);text-decoration:none;font-size:13px}.link:hover{text-decoration:underline}
.foot{text-align:center;margin-top:14px;font-size:12px;color:var(--mu)}
.foot a{color:var(--ac);text-decoration:none}.foot a:hover{text-decoration:underline}
.feats{display:flex;flex-wrap:wrap;gap:5px;margin-top:16px;padding-top:14px;border-top:1px solid var(--bd)}
.feat{display:inline-flex;align-items:center;gap:4px;background:var(--s2);border:1px solid var(--bd);border-radius:20px;padding:3px 8px;font-size:11px;color:var(--tx2)}
.fdot{width:5px;height:5px;border-radius:50%}
`

const ERR_MSGS: Record<string, string> = {
  fill_all:             "Preencha todos os campos.",
  password_short:       "Senha deve ter pelo menos 8 caracteres.",
  password_mismatch:    "As senhas não coincidem.",
  email_taken:          "Este email já está cadastrado.",
  invalid_credentials:  "Email ou senha incorretos.",
  email_not_verified:   "Confirme seu email antes de entrar. Verifique sua caixa de entrada.",
  token_expired:        "Link inválido ou expirado. Solicite um novo.",
  user_not_found:       "Usuário não encontrado.",
  discord_denied:       "Login com Discord cancelado.",
  github_denied:        "Login com GitHub cancelado.",
  google_denied:        "Login com Google cancelado.",
  token_failed:         "Falha ao autenticar. Tente novamente.",
  user_fetch_failed:    "Erro ao buscar dados do perfil. Tente novamente.",
  server_error:         "Erro interno. Tente novamente.",
}

const OK_MSGS: Record<string, string> = {
  check_email:    "📬 Enviamos um link de verificação para o seu email.",
  email_verified: "✓ Email verificado! Faça login abaixo.",
  password_reset: "✓ Senha redefinida! Faça login com a nova senha.",
}

function alert(type: "err" | "ok" | "info", msg: string): string {
  return `<div class="alert alert-${type === "err" ? "err" : type === "ok" ? "ok" : "info"}">
    ${type === "err" ? "⚠️" : type === "ok" ? "✅" : "ℹ️"} ${msg}
  </div>`
}

// ── Login page ────────────────────────────────────────────────────────────────
export function loginPage(errKey?: string, okKey?: string): string {
  const errHtml = errKey ? alert("err", ERR_MSGS[errKey] ?? errKey) : ""
  const okHtml  = okKey  ? alert("ok",  OK_MSGS[okKey]  ?? okKey)  : ""

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Login — Open Neo UI</title>
<style>${CSS_BASE}</style></head>
<body><div class="wrap">
  <div class="logo-area">
    <div class="logo-box">🤖</div>
    <div class="logo-name">Open Neo UI</div>
    <div><span class="logo-ver">v0.2.1 Alpha 2</span></div>
  </div>
  <div class="card">
    ${errHtml}${okHtml}

    <div class="section-lbl">Entrar com conta</div>
    <form method="POST" action="/auth/email/login">
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" name="email" placeholder="voce@exemplo.com" required autocomplete="email"></div>
      <div class="fg"><label class="fl" style="display:flex;justify-content:space-between">Senha <a href="/auth/forgot-password" class="link" style="font-weight:400">Esqueceu?</a></label><input class="fi" type="password" name="password" placeholder="••••••••" required autocomplete="current-password"></div>
      <button class="btn-p" type="submit">Entrar</button>
    </form>

    <div class="divider">ou continue com</div>

    <a href="/auth/discord" class="btn-auth btn-discord">
      <svg viewBox="0 0 24 24" fill="#5865f2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.036.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
      Discord
    </a>
    <a href="/auth/github" class="btn-auth btn-github">
      <svg viewBox="0 0 24 24" fill="#e6edf3"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
      GitHub
    </a>
    <a href="/auth/google" class="btn-auth btn-google">
      <svg viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Google
    </a>

    <div class="feats">
      <span class="feat"><span class="fdot" style="background:var(--gr)"></span>Ollama local</span>
      <span class="feat"><span class="fdot" style="background:var(--ac)"></span>DeepSeek</span>
      <span class="feat"><span class="fdot" style="background:#c9d1d9"></span>OpenAI</span>
      <span class="feat"><span class="fdot" style="background:var(--pu)"></span>Claude</span>
      <span class="feat"><span class="fdot" style="background:var(--ye)"></span>Gemini</span>
    </div>
  </div>
  <div class="foot">Não tem conta? <a href="/auth/register">Criar conta</a> · Licença ISC</div>
</div></body></html>`
}

// ── Register page ─────────────────────────────────────────────────────────────
function registerPage(errKey?: string, okKey?: string): string {
  const errHtml = errKey ? alert("err", ERR_MSGS[errKey] ?? errKey) : ""
  const okHtml  = okKey  ? alert("ok",  OK_MSGS[okKey]  ?? okKey)  : ""
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Criar conta — Open Neo UI</title><style>${CSS_BASE}</style></head>
<body><div class="wrap">
  <div class="logo-area">
    <div class="logo-box">🤖</div>
    <div class="logo-name">Open Neo UI</div>
    <div><span class="logo-ver">v0.2.1 Alpha 2</span></div>
  </div>
  <div class="card">
    ${errHtml}${okHtml}
    <div class="section-lbl">Criar conta com email</div>
    <form method="POST" action="/auth/register">
      <div class="fg"><label class="fl">Nome de usuário</label><input class="fi" type="text" name="username" placeholder="Seu nome" required autocomplete="name"></div>
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" name="email" placeholder="voce@exemplo.com" required autocomplete="email"></div>
      <div class="fg"><label class="fl">Senha <small style="color:var(--mu);font-weight:400">(mín. 8 caracteres)</small></label><input class="fi" type="password" name="password" placeholder="••••••••" required minlength="8" autocomplete="new-password"></div>
      <div class="fg"><label class="fl">Confirmar senha</label><input class="fi" type="password" name="confirm" placeholder="••••••••" required autocomplete="new-password"></div>
      <button class="btn-p" type="submit">Criar conta</button>
    </form>
  </div>
  <div class="foot">Já tem conta? <a href="/login">Entrar</a></div>
</div></body></html>`
}

// ── Forgot password page ──────────────────────────────────────────────────────
function forgotPage(errKey?: string, okKey?: string): string {
  const errHtml = errKey ? alert("err", ERR_MSGS[errKey] ?? errKey) : ""
  const okHtml  = okKey  ? alert("ok",  OK_MSGS[okKey] ?? "Email enviado. Verifique sua caixa de entrada.") : ""
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Esqueceu a senha — Open Neo UI</title><style>${CSS_BASE}</style></head>
<body><div class="wrap">
  <div class="logo-area">
    <div class="logo-box">🔑</div>
    <div class="logo-name">Redefinir senha</div>
    <div><span class="logo-ver">Open Neo UI</span></div>
  </div>
  <div class="card">
    ${errHtml}${okHtml}
    <div class="alert alert-info">ℹ️ Digite seu email e enviaremos um link para redefinir sua senha.</div>
    <form method="POST" action="/auth/forgot-password">
      <div class="fg"><label class="fl">Email</label><input class="fi" type="email" name="email" placeholder="voce@exemplo.com" required autocomplete="email"></div>
      <button class="btn-p" type="submit">Enviar link de redefinição</button>
    </form>
  </div>
  <div class="foot"><a href="/login">← Voltar ao login</a></div>
</div></body></html>`
}

// ── Reset password page ───────────────────────────────────────────────────────
function resetPage(token: string, errKey?: string): string {
  const errHtml = errKey ? alert("err", ERR_MSGS[errKey] ?? errKey) : ""
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Nova senha — Open Neo UI</title><style>${CSS_BASE}</style></head>
<body><div class="wrap">
  <div class="logo-area">
    <div class="logo-box">🔒</div>
    <div class="logo-name">Nova senha</div>
    <div><span class="logo-ver">Open Neo UI</span></div>
  </div>
  <div class="card">
    ${errHtml}
    <form method="POST" action="/auth/reset-password">
      <input type="hidden" name="token" value="${token}">
      <div class="fg"><label class="fl">Nova senha <small style="color:var(--mu);font-weight:400">(mín. 8 caracteres)</small></label><input class="fi" type="password" name="password" placeholder="••••••••" required minlength="8" autocomplete="new-password"></div>
      <div class="fg"><label class="fl">Confirmar nova senha</label><input class="fi" type="password" name="confirm" placeholder="••••••••" required autocomplete="new-password"></div>
      <button class="btn-p" type="submit">Redefinir senha</button>
    </form>
  </div>
  <div class="foot"><a href="/login">← Voltar ao login</a></div>
</div></body></html>`
}
