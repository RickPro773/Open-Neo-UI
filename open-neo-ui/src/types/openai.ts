export type Role = "system" | "user" | "assistant" | "tool"

export interface TextContent  { type: "text"; text: string }
export interface ImageContent { type: "image_url"; image_url: { url: string; detail?: "low"|"high"|"auto" } }
export type MessageContent = string | Array<TextContent | ImageContent>

export interface Message {
  role: Role
  content: MessageContent
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface FunctionDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolDefinition {
  type: "function"
  function: FunctionDefinition
}

export interface ToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type ToolChoice = "none"|"auto"|"required"|{ type:"function"; function:{ name:string } }

export interface ChatCompletionRequest {
  model: string
  messages: Message[]
  tools?: ToolDefinition[]
  tool_choice?: ToolChoice
  temperature?: number
  max_tokens?: number
  stream?: boolean
  stop?: string | string[]
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface Choice {
  index: number
  message: Message
  finish_reason: "stop"|"length"|"tool_calls"|"content_filter"|null
}

export interface ChatCompletionResponse {
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: Choice[]
  usage: Usage
}

export interface ModelObject { id: string; object: "model"; created: number; owned_by: string }
export interface ModelList   { object: "list"; data: ModelObject[] }
export interface OpenAIError { error: { message: string; type: string; code?: string|null } }
