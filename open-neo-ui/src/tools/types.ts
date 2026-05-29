import type { ToolDefinition, ToolCall } from "../types/openai"

export interface ToolContext {
  userId: string
  conversationId: string
  requestId: string
  abortSignal?: AbortSignal
}

export type ToolResultStatus = "success"|"error"|"timeout"|"aborted"

export interface ToolResult {
  status: ToolResultStatus
  output: string
  durationMs: number
  metadata?: Record<string, unknown>
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>

export interface RegisteredTool {
  definition: ToolDefinition
  handler:    ToolHandler
  category:   "web"|"code"|"system"|"ai"|"data"|"utility"
  enabled:    boolean
}

export interface ToolTrace {
  call:      ToolCall
  result:    ToolResult
  timestamp: number
}
