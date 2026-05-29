import type { ToolCall } from "../types/openai"
import type { ToolContext, ToolResult, ToolTrace } from "./types"
import { getTool } from "./registry"
import { validateArgs } from "./schema"

const TIMEOUT = Number(process.env["TOOL_TIMEOUT_MS"] ?? 15_000)

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolTrace> {
  const ts   = Date.now()
  const tool = getTool(call.function.name)

  if (!tool)
    return { call, result:{ status:"error", output:`Unknown tool: "${call.function.name}"`, durationMs:0 }, timestamp:ts }
  if (!tool.enabled)
    return { call, result:{ status:"error", output:`Tool disabled: "${call.function.name}"`, durationMs:0 }, timestamp:ts }

  const val = validateArgs(call.function.arguments, tool.definition.function.parameters)
  if (!val.valid)
    return { call, result:{ status:"error", output:`Bad args: ${val.errors.join("; ")}`, durationMs:0 }, timestamp:ts }

  const start = Date.now()
  try {
    const result = await Promise.race<ToolResult>([
      tool.handler(val.value, ctx),
      new Promise<ToolResult>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT)),
    ])
    console.log(`[tool] ${call.function.name} → ${result.status} (${result.durationMs}ms)`)
    return { call, result, timestamp:ts }
  } catch (e) {
    const isTo = String(e).includes("timeout")
    return { call, result:{ status: isTo?"timeout":"error", output: isTo?`Timeout after ${TIMEOUT}ms`:`Error: ${e}`, durationMs:Date.now()-start }, timestamp:ts }
  }
}

export async function executeTools(calls: ToolCall[], ctx: ToolContext): Promise<ToolTrace[]> {
  return Promise.all(calls.map(c => executeTool(c, ctx)))
}

export function tracesToMessages(traces: ToolTrace[]) {
  return traces.map(t => ({ role:"tool" as const, tool_call_id: t.call.id, content: t.result.output }))
}
