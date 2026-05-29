import { Hono } from "hono"
import { nanoid } from "nanoid"
import { runEngine } from "../runtime/engine"
import { detectProvider } from "../services/deepseek"
import { requireAuth } from "../login"
import { q } from "../db"

export const chatRoute = new Hono()

// ── OpenAI-compatible ─────────────────────────────────────────────────────────
chatRoute.post("/v1/chat/completions", requireAuth, async c => {
  const user = c.get("user")
  const body = await c.req.json()
  const {messages, model, temperature, max_tokens} = body
  const provider = detectProvider(model)

  let apiKey: string|undefined, baseUrl: string|undefined
  if (provider !== "ollama") {
    const row = q.getActiveKey.get(user.id, provider) as any
    if (row) { apiKey=row.key_value; baseUrl=row.base_url??undefined }
    if (!apiKey) {
      const envMap: Record<string,string> = {deepseek:"DEEPSEEK_API_KEY",openai:"OPENAI_API_KEY",anthropic:"ANTHROPIC_API_KEY",gemini:"GEMINI_API_KEY",groq:"GROQ_API_KEY"}
      apiKey = process.env[envMap[provider]??""] || undefined
    }
    if (!apiKey) return c.json({error:{message:`No API key for "${provider}". Add in Settings → Keys.`,type:"auth_error"}},400)
  }

  try {
    const result = await runEngine({userId:user.id,conversationId:nanoid(),model,provider,messages,temperature,max_tokens,apiKey,baseUrl,enableTools:true})
    if (result.response.usage) q.insertStat.run(nanoid(),user.id,provider,model,result.response.usage.prompt_tokens,result.response.usage.completion_tokens)
    return c.json(result.response)
  } catch(e) { console.error("[chat]",e); return c.json({error:{message:String(e),type:"api_error"}},502) }
})

// ── Internal UI chat ──────────────────────────────────────────────────────────
chatRoute.post("/api/chat", requireAuth, async c => {
  const user = c.get("user")
  const {conversationId, message, model, provider:ph} = await c.req.json()
  const provider = ph ?? detectProvider(model)

  let conv = conversationId ? q.getConv.get(conversationId, user.id) as any : null
  if (!conv) {
    const id=nanoid()
    q.insertConv.run(id,user.id,message.slice(0,60)+(message.length>60?"…":""),model,provider)
    conv = q.getConv.get(id, user.id)
  }

  q.insertMsg.run(nanoid(), conv.id, "user", message, 0)
  const history = (q.getMessages.all(conv.id) as any[]).map((m:any)=>({role:m.role,content:m.content}))

  let apiKey: string|undefined, baseUrl: string|undefined
  if (provider !== "ollama") {
    const row = q.getActiveKey.get(user.id, provider) as any
    if (row) { apiKey=row.key_value; baseUrl=row.base_url??undefined }
    if (!apiKey) {
      const envMap: Record<string,string> = {deepseek:"DEEPSEEK_API_KEY",openai:"OPENAI_API_KEY",anthropic:"ANTHROPIC_API_KEY",gemini:"GEMINI_API_KEY",groq:"GROQ_API_KEY"}
      apiKey = process.env[envMap[provider]??""] || undefined
    }
    if (!apiKey) return c.json({error:`No key for "${provider}". Add in Settings.`},400)
  }

  try {
    const result = await runEngine({userId:user.id,conversationId:conv.id,model,provider,messages:history,apiKey,baseUrl,enableTools:true})
    const reply = String(result.response.choices[0]?.message.content??"")
    q.insertMsg.run(nanoid(),conv.id,"assistant",reply,result.response.usage?.completion_tokens??0)
    q.touchConv.run(conv.id)
    if (result.response.usage) q.insertStat.run(nanoid(),user.id,provider,model,result.response.usage.prompt_tokens,result.response.usage.completion_tokens)
    return c.json({conversationId:conv.id,message:reply,usage:result.response.usage,toolsUsed:result.toolTraces.length})
  } catch(e) { return c.json({error:String(e)},502) }
})
