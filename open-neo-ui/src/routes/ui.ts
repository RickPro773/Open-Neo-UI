import { Hono } from "hono"
import { readFileSync } from "fs"
import { join } from "path"
import { authMiddleware, requireAuth } from "../middleware/auth"

export const uiRoute = new Hono()

const viewsPath = join(import.meta.dir, "../ui/views")

function readView(name: string): string {
  return readFileSync(join(viewsPath, name), "utf8")
}

// ── Login page ─────────────────────────────────────────────────────────────
uiRoute.get("/login", authMiddleware, (c) => {
  // Se já estiver logado, redireciona
  const user = c.get("user")
  if (user) return c.redirect("/")

  const error = c.req.query("error")
  const errorMessages: Record<string, string> = {
    discord_denied:   "Login cancelado. Tente novamente.",
    token_failed:     "Falha ao autenticar com Discord.",
    user_fetch_failed:"Não foi possível buscar seus dados do Discord.",
    server_error:     "Erro interno. Tente novamente.",
  }

  const errorHtml = error
    ? `<div class="error-msg">⚠️ ${errorMessages[error] ?? "Erro desconhecido."}</div>`
    : ""

  const html = readView("login.html").replace("{{ERROR_MSG}}", errorHtml)
  return c.html(html)
})

// ── Main app ───────────────────────────────────────────────────────────────
uiRoute.get("/", authMiddleware, requireAuth, (c) => {
  const user = c.get("user")

  const avatarHtml = user.avatar
    ? `<img src="${user.avatar}" alt="${user.username}">`
    : user.username.slice(0, 2).toUpperCase()

  const html = readView("app.html")
    .replace(/\{\{USERNAME\}\}/g, user.username)
    .replace(/\{\{AVATAR\}\}/g, avatarHtml)
    .replace(/\{\{AVATAR_URL\}\}/g, user.avatar ?? "")

  return c.html(html)
})
