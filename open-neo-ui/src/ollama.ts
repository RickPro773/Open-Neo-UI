const BASE = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434"

export interface OllamaModel { name:string; size:number; modified_at:string; details?:{parameter_size?:string;family?:string} }

export const isRunning = async () => {
  try { return (await fetch(`${BASE}/api/version`,{signal:AbortSignal.timeout(2000)})).ok } catch { return false }
}
export const listModels = async (): Promise<OllamaModel[]> => {
  try { const r=await fetch(`${BASE}/api/tags`,{signal:AbortSignal.timeout(3000)}); if(!r.ok)return[]; return ((await r.json()) as {models:OllamaModel[]}).models??[] } catch { return [] }
}
export const pullModel = async (name:string) => {
  const r=await fetch(`${BASE}/api/pull`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,stream:true})})
  if(!r.ok) throw new Error(`Pull failed: ${r.status}`)
  return r.body!.pipeThrough(new TextDecoderStream()) as ReadableStream<string>
}
export const deleteModel = async (name:string) =>
  fetch(`${BASE}/api/delete`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})})

export const catalog = [
  {name:"gemma2:2b",       label:"Gemma 2 2B",      size:"1.6 GB", tags:["rápido","google"]},
  {name:"gemma2:9b",       label:"Gemma 2 9B",       size:"5.4 GB", tags:["balanceado","google"]},
  {name:"llama3.2:3b",     label:"Llama 3.2 3B",     size:"2.0 GB", tags:["rápido","meta"]},
  {name:"llama3.1:8b",     label:"Llama 3.1 8B",     size:"4.7 GB", tags:["balanceado","meta"]},
  {name:"mistral:7b",      label:"Mistral 7B",       size:"4.1 GB", tags:["balanceado","mistral"]},
  {name:"qwen2.5:7b",      label:"Qwen 2.5 7B",      size:"4.4 GB", tags:["balanceado","alibaba"]},
  {name:"qwen2.5:14b",     label:"Qwen 2.5 14B",     size:"8.9 GB", tags:["potente","alibaba"]},
  {name:"deepseek-r1:7b",  label:"DeepSeek R1 7B",   size:"4.7 GB", tags:["raciocínio","deepseek"]},
  {name:"deepseek-r1:14b", label:"DeepSeek R1 14B",  size:"8.9 GB", tags:["potente","deepseek"]},
  {name:"phi4:14b",        label:"Phi-4 14B",        size:"8.9 GB", tags:["potente","microsoft"]},
  {name:"codellama:7b",    label:"CodeLlama 7B",     size:"3.8 GB", tags:["código","meta"]},
  {name:"llava:7b",        label:"LLaVA 7B",         size:"4.5 GB", tags:["visão","multimodal"]},
]
