import type { Message } from "../types/openai"
import type { RunConfig, RunResult } from "./types"
import { getEnabledTools } from "../tools/registry"
import { executeTools, tracesToMessages } from "../tools/executor"
import { callProvider } from "../services/deepseek"
import { nanoid } from "nanoid"

const MAX_ITER = Number(process.env["MAX_TOOL_CALLS"] ?? 10)

export async function runEngine(cfg: RunConfig): Promise<RunResult> {
  const traces   = []
  let messages   = [...cfg.messages]
  let iterations = 0, totalTokens = 0
  const tools    = cfg.enableTools ? getEnabledTools() : undefined

  while (iterations < MAX_ITER) {
    iterations++
    const response = await callProvider({
      provider:    cfg.provider,
      model:       cfg.model,
      messages,
      tools,
      temperature: cfg.temperature,
      max_tokens:  cfg.max_tokens,
      apiKey:      cfg.apiKey,
      baseUrl:     cfg.baseUrl,
    })

    totalTokens += response.usage?.total_tokens ?? 0
    const choice = response.choices[0]
    if (!choice) return { response, toolTraces: traces as any, iterations, totalTokens }

    messages = [...messages, choice.message]

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      console.log(`[engine] iter=${iterations} tools=${choice.message.tool_calls.length}`)
      const newTraces = await executeTools(choice.message.tool_calls, {
        userId: cfg.userId, conversationId: cfg.conversationId, requestId: nanoid(),
      });
      (traces as any[]).push(...newTraces)
      messages = [...messages, ...tracesToMessages(newTraces)]
      continue
    }

    return { response, toolTraces: traces as any, iterations, totalTokens }
  }

  console.warn(`[engine] max iterations (${MAX_ITER}) reached`)
  return { response: { id:"", object:"chat.completion", created:0, model:cfg.model, choices:[], usage:{ prompt_tokens:0, completion_tokens:0, total_tokens:totalTokens } }, toolTraces: traces as any, iterations, totalTokens }
}
