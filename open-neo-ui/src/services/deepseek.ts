import type { Message, ToolDefinition, ChatCompletionResponse } from "../types/openai"

const BASE: Record<string, string> = {
  deepseek:   "https://api.deepseek.com/v1",
  openai:     "https://api.openai.com/v1",
  anthropic:  "https://api.anthropic.com/v1",
  gemini:     "https://generativelanguage.googleapis.com/v1beta/openai",
  groq:       "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama:     `${process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434"}/v1`,
}

const ENV_KEY: Record<string, string> = {
  deepseek:"DEEPSEEK_API_KEY", openai:"OPENAI_API_KEY",
  anthropic:"ANTHROPIC_API_KEY", gemini:"GEMINI_API_KEY",
  groq:"GROQ_API_KEY", openrouter:"OPENROUTER_API_KEY",
}

export interface ProviderCallOpts {
  provider: string; model: string
  messages: Message[]; tools?: ToolDefinition[]
  temperature?: number; max_tokens?: number
  apiKey?: string; baseUrl?: string
}

export async function callProvider(o: ProviderCallOpts): Promise<ChatCompletionResponse> {
  const base   = o.baseUrl ?? BASE[o.provider] ?? BASE["deepseek"]!
  const envKey = ENV_KEY[o.provider] ?? ""
  const apiKey = o.apiKey ?? (envKey ? process.env[envKey] : undefined)

  const body: Record<string, unknown> = {
    model:       o.model,
    messages:    o.messages,
    temperature: o.temperature ?? 0.7,
    max_tokens:  o.max_tokens ?? 4096,
  }
  if (o.tools?.length) { body["tools"] = o.tools; body["tool_choice"] = "auto" }

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
  if (o.provider === "openrouter") {
    headers["HTTP-Referer"] = "http://localhost:3000"
    headers["X-Title"]      = "Open Neo UI"
  }

  const res = await fetch(`${base}/chat/completions`, {
    method:"POST", headers, body:JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`[${o.provider}] HTTP ${res.status}: ${txt}`)
  }
  return res.json()
}

export function detectProvider(model: string): string {
  if (model.startsWith("deepseek"))                      return "deepseek"
  if (model.startsWith("gpt")||model.startsWith("o1")||model.startsWith("o3")) return "openai"
  if (model.startsWith("claude"))                        return "anthropic"
  if (model.startsWith("gemini"))                        return "gemini"
  if (model.startsWith("gemma")||model.startsWith("llama")||
      model.startsWith("mistral")||model.startsWith("qwen")||
      model.startsWith("phi")||model.startsWith("codellama")||
      model.includes(":"))                               return "ollama"
  if (model.includes("/"))                               return "openrouter"
  return "deepseek"
}
