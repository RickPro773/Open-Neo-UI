import { Hono } from "hono"
import { nanoid } from "nanoid"
import { queries } from "../db/database"
import { signToken, setSessionCookie, clearSessionCookie } from "../middleware/auth"

export const authRoute = new Hono()

const DISCORD_API = "https://discord.com/api/v10"

// ── Inicia o fluxo OAuth2 ─────────────────────────────────────────────────────
authRoute.get("/auth/discord", (c) => {
  const clientId = process.env.DISCORD_CLIENT_ID
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI ?? "")
  const scope = encodeURIComponent("identify email")
  const state = nanoid(16)

  // Salva state num cookie temporário para validação (CSRF)
  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`

  return c.redirect(url)
})

// ── Callback do Discord ───────────────────────────────────────────────────────
authRoute.get("/auth/discord/callback", async (c) => {
  const code = c.req.query("code")
  const error = c.req.query("error")

  if (error || !code) {
    return c.redirect("/login?error=discord_denied")
  }

  try {
    // Troca o code pelo access token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID ?? "",
        client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI ?? "",
      }),
    })

    if (!tokenRes.ok) {
      console.error("[auth] Token exchange failed:", await tokenRes.text())
      return c.redirect("/login?error=token_failed")
    }

    const tokenData = await tokenRes.json() as { access_token: string }

    // Busca os dados do usuário no Discord
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      return c.redirect("/login?error=user_fetch_failed")
    }

    const discordUser = await userRes.json() as {
      id: string
      username: string
      avatar: string | null
      email: string | null
      global_name: string | null
    }

    const displayName = discordUser.global_name ?? discordUser.username
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null

    // Upsert do usuário no banco
    let user = queries.getUserByDiscordId.get(discordUser.id) as any

    if (!user) {
      const userId = nanoid()
      // Primeiro usuário vira admin automaticamente
      const existingUsers = (queries.getUserById.get("check") as any) 
      const allUsers = (db_count())
      const role = allUsers === 0 ? "admin" : "user"

      queries.createUser.run(userId, discordUser.id, displayName, avatarUrl, discordUser.email, role)
      user = queries.getUserById.get(userId) as any
    } else {
      queries.updateUserLogin.run(displayName, avatarUrl, user.id)
      user = queries.getUserById.get(user.id) as any
    }

    // Assina o JWT e seta o cookie
    const token = await signToken({
      id:         user.id,
      discord_id: user.discord_id,
      username:   user.username,
      avatar:     user.avatar,
      role:       user.role,
    })

    return new Response(null, {
      status: 302,
      headers: {
        Location:   "/",
        "Set-Cookie": setSessionCookie(token),
      },
    })
  } catch (err) {
    console.error("[auth] OAuth error:", err)
    return c.redirect("/login?error=server_error")
  }
})

// ── Logout ─────────────────────────────────────────────────────────────────
authRoute.get("/auth/logout", (c) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location:   "/login",
      "Set-Cookie": clearSessionCookie(),
    },
  })
})

// Helper — conta total de usuários
function db_count(): number {
  const { db } = require("../db/database")
  const row = db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number }
  return row.n
}
