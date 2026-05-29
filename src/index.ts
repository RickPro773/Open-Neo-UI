import { Hono } from "hono"
import { logger } from "hono/logger"
import "./db"
import { sessionMiddleware, authRoute, requireAuth, loginPage } from "./login"
import { chatRoute } from "./routes/chat"
import { nanoid } from "nanoid"
import { q } from "./db"
import { maskKey, relTime } from "./utils/types"
import { isRunning, listModels, pullModel, deleteModel, catalog } from "./ollama"
import { sysStats } from "./gpu"
import { createToken, verifyToken as verifyRemote, getTokens } from "./remote"
import { startTray } from "./tray"
import { readFileSync } from "fs"
import { join } from "path"

const VERSION = "0.2.1-alpha.2"
const PORT    = Number(process.env["PORT"] ?? 3000)
const app     = new Hono()

app.use("*", logger())
app.use("*", sessionMiddleware)

// ── Auth ──────────────────────────────────────────────────────────────────────
app.route("/", authRoute)
app.route("/", chatRoute)

// ── Serve HTML views ──────────────────────────────────────────────────────────
const VIEWS = join(import.meta.dir, "ui/views")
const view  = (f: string) => readFileSync(join(VIEWS, f), "utf8")

app.get("/login", c => {
  if (c.get("user")) return c.redirect("/")
  return c.html(loginPage(c.req.query("error"), c.req.query("ok")))
})

app.get("/", sessionMiddleware, requireAuth, c => {
  const u   = c.get("user")
  const av  = u.avatar ? `<img src="${u.avatar}" alt="">` : u.username.slice(0,2).toUpperCase()
  return c.html(
    view("app.html")
      .replace(/\{\{VER\}\}/g,      VERSION)
      .replace(/\{\{USER\}\}/g,     u.username)
      .replace(/\{\{AVATAR\}\}/g,   av)
      .replace(/\{\{AVU\}\}/g,      u.avatar ?? "")
      .replace(/\{\{PROV\}\}/g,     u.provider)
  )
})

// ── REST API ──────────────────────────────────────────────────────────────────
const api = new Hono()
api.use("*", requireAuth)

api.get("/me", c => c.json(c.get("user")))

// Keys
api.get("/keys", c => c.json((q.getKeys.all(c.get("user").id) as any[]).map(k=>({...k,key_value:maskKey(k.key_value)}))))
api.post("/keys", async c => {
  const u=c.get("user"), {name,provider,key_value,base_url,model_default}=await c.req.json()
  if(!name||!provider||!key_value) return c.json({error:"name,provider,key_value required"},400)
  const id=nanoid(); q.insertKey.run(id,u.id,name,provider,key_value,base_url??null,model_default??null)
  return c.json({ok:true,id})
})
api.delete("/keys/:id", c=>{q.deleteKey.run(c.req.param("id"),c.get("user").id);return c.json({ok:true})})
api.patch("/keys/:id/toggle", c=>{
  const k=q.getKeyById.get(c.req.param("id"),c.get("user").id) as any
  if(!k) return c.json({error:"not found"},404)
  q.toggleKey.run(k.is_active?0:1,k.id,c.get("user").id); return c.json({ok:true})
})

// Conversations
api.get("/conversations", c=>c.json(q.getConvs.all(c.get("user").id)))
api.get("/conversations/:id/messages", c=>{
  const cv=q.getConv.get(c.req.param("id"),c.get("user").id) as any
  if(!cv) return c.json({error:"not found"},404)
  return c.json(q.getMessages.all(cv.id))
})
api.delete("/conversations/:id", c=>{q.deleteConv.run(c.req.param("id"),c.get("user").id);return c.json({ok:true})})

// Stats
api.get("/stats", c=>c.json(q.getStats.all(c.get("user").id)))

// Ollama
api.get("/ollama/status", async c=>{
  const running=await isRunning(), models=running?await listModels():[]
  return c.json({running,models})
})
api.get("/ollama/catalog", c=>c.json(catalog))
api.post("/ollama/pull", async c=>{
  const {name}=await c.req.json(); if(!name) return c.json({error:"name required"},400)
  const stream=await pullModel(name)
  return new Response(stream as any,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"}})
})
api.delete("/ollama/models/:name", async c=>{
  await deleteModel(decodeURIComponent(c.req.param("name"))); return c.json({ok:true})
})

// System / GPU
api.get("/system", async c=>c.json(await sysStats()))

// Remote tokens
api.get("/remote-tokens", c=>c.json(getTokens(c.get("user").id)))
api.post("/remote-tokens", async c=>{
  const {label}=await c.req.json()
  const raw=await createToken(c.get("user").id, label)
  return c.json({token:raw,note:"Salve agora — não será exibido novamente."})
})
api.delete("/remote-tokens/:id", c=>{
  q.revokeToken.run(c.req.param("id"),c.get("user").id); return c.json({ok:true})
})

// Models list (OpenAI compat)
api.get("/v1/models", async c=>{
  const om=await listModels()
  return c.json({object:"list",data:[
    {id:"deepseek-chat",      object:"model",created:1700000000,owned_by:"deepseek"},
    {id:"deepseek-reasoner",  object:"model",created:1700000001,owned_by:"deepseek"},
    {id:"gpt-4o",             object:"model",created:1700000002,owned_by:"openai"},
    {id:"gpt-4o-mini",        object:"model",created:1700000003,owned_by:"openai"},
    {id:"claude-3-5-sonnet-20241022",object:"model",created:1700000004,owned_by:"anthropic"},
    {id:"gemini-1.5-pro",     object:"model",created:1700000005,owned_by:"google"},
    ...om.map(m=>({id:m.name,object:"model",created:1700000010,owned_by:"ollama"}))
  ]})
})

app.route("/api", api)
app.get("/health", c=>c.json({ok:true,version:VERSION,ts:new Date().toISOString()}))
app.notFound(c=>c.json({error:"Not found"},404))
app.onError((e,c)=>{console.error(e);return c.json({error:e.message},500)})

export default { port: PORT, fetch: app.fetch }

// ── Banner ────────────────────────────────────────────────────────────────────
console.log(`
 ╔═══════════════════════════════════════════╗
 ║   Open Neo UI  v${VERSION}         ║
 ╠═══════════════════════════════════════════╣
 ║  🟢  http://localhost:${PORT}                ║
 ║  🔑  Discord · GitHub · Google            ║
 ║  🧠  DeepSeek · OpenAI · Claude · Gemini  ║
 ║  🏠  Ollama (local)                       ║
 ║  🛠️   Tool calling + agentic loop          ║
 ╚═══════════════════════════════════════════╝
`)

// Open browser + tray after server is ready
setTimeout(async () => {
  const url = `http://localhost:${PORT}`
  const { exec } = await import("child_process")
  const cmd = process.platform==="win32" ? `start ${url}`
    : process.platform==="darwin" ? `open ${url}`
    : `xdg-open ${url}`
  exec(cmd)
  startTray()
}, 1200)
