import { isObject } from "../utils/types"

export type ValidationResult =
  | { valid: true;  value: Record<string, unknown> }
  | { valid: false; errors: string[] }

export function validateArgs(args: unknown, schema: Record<string, unknown>): ValidationResult {
  let parsed: unknown = args
  if (typeof args === "string") {
    try { parsed = JSON.parse(args) }
    catch { return { valid: false, errors: ["Arguments is not valid JSON"] } }
  }
  if (!isObject(parsed)) return { valid: false, errors: ["Arguments must be an object"] }

  const errors: string[] = []
  const props    = schema["properties"] as Record<string, Record<string, unknown>> | undefined
  const required = (schema["required"] as string[]) ?? []

  for (const f of required) {
    if (!(f in parsed)) errors.push(`Missing required: "${f}"`)
  }

  if (props) {
    for (const [f, def] of Object.entries(props)) {
      if (!(f in parsed)) continue
      const v = parsed[f], t = def["type"] as string|undefined
      if (t === "string"  && typeof v !== "string")  errors.push(`"${f}" must be string`)
      if (t === "number"  && typeof v !== "number")  errors.push(`"${f}" must be number`)
      if (t === "boolean" && typeof v !== "boolean") errors.push(`"${f}" must be boolean`)
      if (t === "array"   && !Array.isArray(v))      errors.push(`"${f}" must be array`)
      if (t === "object"  && !isObject(v))           errors.push(`"${f}" must be object`)
      const ev = def["enum"] as unknown[]|undefined
      if (ev && !ev.includes(v)) errors.push(`"${f}" must be one of: ${ev.join(", ")}`)
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, value: parsed }
}

export function buildSchema(
  props: Record<string, { type: string; description: string; enum?: string[]; required?: boolean }>
): Record<string, unknown> {
  const required: string[] = []
  const p: Record<string, unknown> = {}
  for (const [k, d] of Object.entries(props)) {
    if (d.required) required.push(k)
    p[k] = { type: d.type, description: d.description, ...(d.enum ? { enum: d.enum } : {}) }
  }
  return { type: "object", properties: p, required }
}
