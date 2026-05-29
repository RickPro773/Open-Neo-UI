import { describe, test, expect, mock } from "bun:test"
import { executeTools, tracesToMessages } from "./tools/executor"
import { getTool, getEnabledTools } from "./tools/registry"
import type { ToolCall } from "./types/openai"

const mockCtx = { userId: "test", conversationId: "conv1", requestId: "req1" }

describe("tools/executor", () => {
  test("executeTools returns traces", async () => {
    const calls: ToolCall[] = [{
      id: "call_1",
      type: "function",
      function: { name: "get_datetime", arguments: "{}" },
    }]
    const traces = await executeTools(calls, mockCtx)
    expect(traces).toHaveLength(1)
    expect(traces[0]!.result.status).toBe("success")
  })

  test("unknown tool returns error", async () => {
    const calls: ToolCall[] = [{
      id: "call_2",
      type: "function",
      function: { name: "nonexistent_tool", arguments: "{}" },
    }]
    const traces = await executeTools(calls, mockCtx)
    expect(traces[0]!.result.status).toBe("error")
    expect(traces[0]!.result.output).toContain("Unknown tool")
  })

  test("invalid args returns error", async () => {
    const calls: ToolCall[] = [{
      id: "call_3",
      type: "function",
      function: { name: "calculate", arguments: '{"expression": "rm -rf /"}' },
    }]
    const traces = await executeTools(calls, mockCtx)
    expect(traces[0]!.result.status).toBe("error")
  })

  test("calculate tool works", async () => {
    const calls: ToolCall[] = [{
      id: "call_4",
      type: "function",
      function: { name: "calculate", arguments: '{"expression": "2 ** 10"}' },
    }]
    const traces = await executeTools(calls, mockCtx)
    expect(traces[0]!.result.status).toBe("success")
    expect(traces[0]!.result.output).toBe("1024")
  })

  test("tracesToMessages formats correctly", async () => {
    const calls: ToolCall[] = [{ id:"c1", type:"function", function:{name:"get_datetime",arguments:"{}"} }]
    const traces = await executeTools(calls, mockCtx)
    const msgs = tracesToMessages(traces)
    expect(msgs[0]!.role).toBe("tool")
    expect(msgs[0]!.tool_call_id).toBe("c1")
  })
})

describe("tools/registry", () => {
  test("all default tools registered", () => {
    expect(getTool("web_search")).toBeDefined()
    expect(getTool("fetch_url")).toBeDefined()
    expect(getTool("get_datetime")).toBeDefined()
    expect(getTool("calculate")).toBeDefined()
  })

  test("getEnabledTools returns definitions", () => {
    const tools = getEnabledTools()
    expect(tools.length).toBeGreaterThan(0)
    expect(tools[0]).toHaveProperty("type", "function")
    expect(tools[0]).toHaveProperty("function.name")
  })
})
