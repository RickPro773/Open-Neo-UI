import type { Message, ChatCompletionResponse } from "../types/openai"
import type { ToolTrace } from "../tools/types"

export interface RunConfig {
  userId: string; conversationId: string
  model: string;  provider: string
  messages: Message[]
  temperature?: number; max_tokens?: number
  apiKey?: string; baseUrl?: string
  enableTools: boolean
}

export interface RunResult {
  response:    ChatCompletionResponse
  toolTraces:  ToolTrace[]
  iterations:  number
  totalTokens: number
}
