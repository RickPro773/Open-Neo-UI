import type { RegisteredTool } from "./types"
import type { ToolDefinition } from "../types/openai"
import { buildSchema } from "./schema"

const registry = new Map<string, RegisteredTool>()

export const registerTool  = (t: RegisteredTool) => registry.set(t.definition.function.name, t)
export const getTool       = (name: string) => registry.get(name)
export const getEnabledTools = (): ToolDefinition[] =>
  [...registry.values()].filter(t => t.enabled).map(t => t.definition)

// ── web_search ────────────────────────────────────────────────────────────────
registerTool({
  category: "web", enabled: true,
  definition: { type:"function", function: {
    name: "web_search",
    description: "Search the web for current information, news, prices, or any up-to-date data.",
    parameters: buildSchema({
      query:       { type:"string",  description:"Search query",        required:true  },
      max_results: { type:"number",  description:"Pages to scrape 1-3", required:false },
    }),
  }},
  handler: async (args, _ctx) => {
    const { getWebContext } = await import("../services/playwright")
    const start = Date.now()
    try {
      const r = await getWebContext(String(args["query"]??""), Number(args["max_results"]??2))
      return { status:"success", output: r ?? "No results.", durationMs: Date.now()-start }
    } catch (e) {
      return { status:"error", output:`Search failed: ${e}`, durationMs: Date.now()-start }
    }
  },
})

// ── get_datetime ──────────────────────────────────────────────────────────────
registerTool({
  category: "utility", enabled: true,
  definition: { type:"function", function: {
    name: "get_datetime",
    description: "Get the current date and time.",
    parameters: buildSchema({ timezone:{ type:"string", description:"IANA timezone", required:false } }),
  }},
  handler: async (args, _ctx) => {
    const start = Date.now()
    try {
      const fmt = new Intl.DateTimeFormat("pt-BR", {
        timeZone: String(args["timezone"]??"America/Sao_Paulo"),
        dateStyle:"full", timeStyle:"long",
      }).format(new Date())
      return { status:"success", output: fmt, durationMs: Date.now()-start }
    } catch {
      return { status:"success", output: new Date().toISOString(), durationMs: Date.now()-start }
    }
  },
})

// ── calculate ─────────────────────────────────────────────────────────────────
registerTool({
  category: "utility", enabled: true,
  definition: { type:"function", function: {
    name: "calculate",
    description: "Evaluate a math expression. e.g. '2**10', 'Math.sqrt(144)'",
    parameters: buildSchema({ expression:{ type:"string", description:"JS-safe math expression", required:true } }),
  }},
  handler: async (args, _ctx) => {
    const start = Date.now()
    const expr  = String(args["expression"]??"")
    const safe  = /^[\d\s+\-*/().,%Math\w]+$/.test(expr)
    if (!safe) return { status:"error", output:"Unsafe expression.", durationMs:0 }
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict";return(${expr})`)()
      return { status:"success", output: String(result), durationMs: Date.now()-start }
    } catch (e) {
      return { status:"error", output:`Calc error: ${e}`, durationMs: Date.now()-start }
    }
  },
})

// ── python_ai (optional bridge) ───────────────────────────────────────────────
registerTool({
  category: "ai", enabled: !!(process.env["PYTHON_BRIDGE_URL"]),
  definition: { type:"function", function: {
    name: "python_ai",
    description: "Advanced AI tasks via Python: image analysis, DALL-E, Gemini, embeddings.",
    parameters: buildSchema({
      task:      { type:"string", description:"chat|embed|image_gen|image_analyze", required:true, enum:["chat","embed","image_gen","image_analyze"] },
      model:     { type:"string", description:"Model: gpt-4o, gemini-1.5-pro, dall-e-3", required:true },
      prompt:    { type:"string", description:"The prompt", required:true },
      image_url: { type:"string", description:"Image URL for analysis", required:false },
    }),
  }},
  handler: async (args, _ctx) => {
    const start = Date.now()
    try {
      const res = await fetch(`${process.env["PYTHON_BRIDGE_URL"]}/run`, {
        method:"POST",
        headers:{"Content-Type":"application/json","X-Bridge-Secret": process.env["PYTHON_BRIDGE_SECRET"]??""},
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`Bridge ${res.status}`)
      const d = await res.json() as { result:string }
      return { status:"success", output: d.result, durationMs: Date.now()-start }
    } catch (e) {
      return { status:"error", output:`Bridge failed: ${e}`, durationMs: Date.now()-start }
    }
  },
})

export { registry }
