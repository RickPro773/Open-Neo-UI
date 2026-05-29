import { describe, test, expect } from "bun:test"
import { validateArgs, buildSchema } from "./tools/schema"
import { maskKey, fmtBytes, ok, err, tryAsync } from "./utils/types"
import { detectProvider } from "./services/deepseek"

describe("utils/types", () => {
  test("ok wraps value", () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  test("err wraps error", () => {
    const r = err("oops")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe("oops")
  })

  test("tryAsync catches", async () => {
    const r = await tryAsync(() => Promise.reject(new Error("boom")))
    expect(r.ok).toBe(false)
  })

  test("maskKey masks correctly", () => {
    expect(maskKey("sk-abcdefghijklmnop")).toMatch(/^sk-abc/)
    expect(maskKey("sk-abcdefghijklmnop")).toMatch(/mnop$/)
    expect(maskKey("short")).toBe("••••••••")
  })

  test("fmtBytes formats", () => {
    expect(fmtBytes(1500)).toBe("2 KB")
    expect(fmtBytes(2_000_000)).toBe("2 MB")
    expect(fmtBytes(1_500_000_000)).toBe("1.5 GB")
  })
})

describe("tools/schema", () => {
  const schema = buildSchema({
    query:   { type: "string",  description: "search query", required: true },
    limit:   { type: "number",  description: "max results",  required: false },
    verbose: { type: "boolean", description: "verbose mode", required: false },
  })

  test("valid args pass", () => {
    const r = validateArgs({ query: "hello", limit: 5 }, schema)
    expect(r.valid).toBe(true)
  })

  test("missing required fails", () => {
    const r = validateArgs({ limit: 5 }, schema)
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.errors[0]).toContain("query")
  })

  test("wrong type fails", () => {
    const r = validateArgs({ query: "hi", limit: "not-a-number" }, schema)
    expect(r.valid).toBe(false)
  })

  test("parses JSON string args", () => {
    const r = validateArgs(JSON.stringify({ query: "test" }), schema)
    expect(r.valid).toBe(true)
  })
})

describe("services/deepseek", () => {
  test("detectProvider deepseek", () => expect(detectProvider("deepseek-chat")).toBe("deepseek"))
  test("detectProvider openai",   () => expect(detectProvider("gpt-4o")).toBe("openai"))
  test("detectProvider anthropic",() => expect(detectProvider("claude-3-5-sonnet-20241022")).toBe("anthropic"))
  test("detectProvider ollama",   () => expect(detectProvider("llama3.2:3b")).toBe("ollama"))
  test("detectProvider openrouter",()=> expect(detectProvider("meta-llama/llama-3")).toBe("openrouter"))
})
