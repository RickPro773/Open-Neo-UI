import { Hono } from "hono"
import { nanoid } from "nanoid"
import { queries } from "../db/database"
import { requireAuth } from "../middleware/auth"

export const keysRoute = new Hono()

// Listar chaves do usuário (mascaradas)
keysRoute.get("/api/keys", requireAuth, (c) => {
  const user = c.get("user")
  const keys = (queries.getKeysByUser.get(user.id) as any[]).map((k: any) => ({
    ...k,
    key_value: maskKey(k.key_value), // nunca expõe a chave completa
  }))
  return c.json(keys)
})

// Adicionar nova chave
keysRoute.post("/api/keys", requireAuth, async (c) => {
  const user = c.get("user")
  const body = await c.req.json()
  const { name, provider, key_value, base_url, model_default } = body

  if (!name || !provider || !key_value) {
    return c.json({ error: "name, provider e key_value são obrigatórios" }, 400)
  }

  const id = nanoid()
  queries.createKey.run(id, user.id, name, provider, key_value, base_url ?? null, model_default ?? null)

  return c.json({ ok: true, id })
})

// Deletar chave
keysRoute.delete("/api/keys/:id", requireAuth, (c) => {
  const user = c.get("user")
  queries.deleteKey.run(c.req.param("id"), user.id)
  return c.json({ ok: true })
})

// Ativar/desativar chave
keysRoute.patch("/api/keys/:id/toggle", requireAuth, async (c) => {
  const user = c.get("user")
  const key = queries.getKeyById.get(c.req.param("id"), user.id) as any
  if (!key) return c.json({ error: "Not found" }, 404)
  queries.toggleKey.run(key.is_active ? 0 : 1, key.id, user.id)
  return c.json({ ok: true, is_active: !key.is_active })
})

// Stats de uso
keysRoute.get("/api/stats", requireAuth, (c) => {
  const user = c.get("user")
  return c.json(queries.getStatsByUser.get(user.id))
})

// Me — dados do usuário logado
keysRoute.get("/api/me", requireAuth, (c) => {
  const user = c.get("user")
  return c.json(user)
})

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return key.slice(0, 6) + "••••••••••••" + key.slice(-4)
}
