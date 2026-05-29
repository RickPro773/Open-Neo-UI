export interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ProviderRequest {
  messages: Message[]
  model: string
  apiKey: string
  baseUrl?: string
  temperature?: number
  max_tokens?: number
}

export interface ProviderResponse {
  id: string
  object: string
  model: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Detecta qual endpoint usar baseado no provider
export async function callProvider(
  provider: string,
  req: ProviderRequest
): Promise<ProviderResponse> {
  const baseUrl = req.baseUrl ?? getDefaultBaseUrl(provider)
  const endpoint = `${baseUrl}/chat/completions`

  const body = {
    model:       req.model,
    messages:    req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens:  req.max_tokens ?? 2048,
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[${provider}] API error ${res.status}: ${err}`)
  }

  return res.json()
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    deepseek:  "https://api.deepseek.com/v1",
    openai:    "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    ollama:    "http://localhost:11434/v1",
    groq:      "https://api.groq.com/openai/v1",
    openrouter:"https://openrouter.ai/api/v1",
  }
  return urls[provider] ?? "https://api.openai.com/v1"
}

// Modelos padrão por provider
export const defaultModels: Record<string, string[]> = {
  deepseek:   ["deepseek-chat", "deepseek-reasoner"],
  openai:     ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  anthropic:  ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  ollama:     ["llama3", "mistral", "qwen2", "phi3"],
  groq:       ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3-70b"],
}
