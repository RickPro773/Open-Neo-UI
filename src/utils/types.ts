export type Ok<T>  = { ok: true;  value: T }
export type Err<E> = { ok: false; error: E }
export type Result<T, E = string> = Ok<T> | Err<E>

export const ok  = <T>(v: T): Ok<T>  => ({ ok: true,  value: v })
export const err = <E>(e: E): Err<E> => ({ ok: false, error: e })

export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return ok(await fn()) }
  catch (e) { return err(e instanceof Error ? e.message : String(e)) }
}

export const now = () => Math.floor(Date.now() / 1000)

export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••"
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`
}

export function fmtBytes(b: number): string {
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b > 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${(b / 1e3).toFixed(0)} KB`
}

export function relTime(ts: number): string {
  const d = now() - ts
  if (d < 60)    return "agora"
  if (d < 3600)  return `${Math.floor(d/60)}m atrás`
  if (d < 86400) return `${Math.floor(d/3600)}h atrás`
  return `${Math.floor(d/86400)}d atrás`
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}
