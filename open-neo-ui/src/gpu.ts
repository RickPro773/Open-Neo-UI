import { promisify } from "util"
import { exec as cb } from "child_process"
const exec = promisify(cb)

export async function sysStats() {
  const [gpu,ram,cpu] = await Promise.all([gpuStats(),ramStats(),cpuStats()])
  return {gpu,ram,cpu}
}

async function gpuStats() {
  try {
    const {stdout} = await exec("nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu --format=csv,noheader,nounits",{timeout:3000})
    const [name,um,tm,util,temp] = stdout.trim().split(", ")
    return {available:true,name:name!.trim(),used_mb:+um!,total_mb:+tm!,utilization:+util!,temperature:+temp!}
  } catch {
    return {available:false,name:"No NVIDIA GPU detected",used_mb:0,total_mb:0,utilization:0,temperature:0}
  }
}

async function ramStats() {
  try {
    if (process.platform==="linux") {
      const {stdout}=await exec("free -m")
      const parts=stdout.split("\n")[1]!.trim().split(/\s+/)
      const [,tot,,used]=[...parts]
      return {total_mb:+tot!,used_mb:+used!,percent:Math.round(+used!/+tot!*100)}
    }
    if (process.platform==="win32") {
      const {stdout}=await exec("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /VALUE",{timeout:3000})
      const free=+(stdout.match(/FreePhysicalMemory=(\d+)/)?.[1]??"0")
      const tot =+(stdout.match(/TotalVisibleMemorySize=(\d+)/)?.[1]??"0")
      const used=tot-free
      return {total_mb:Math.round(tot/1024),used_mb:Math.round(used/1024),percent:Math.round(used/tot*100)}
    }
  } catch {}
  return {total_mb:0,used_mb:0,percent:0}
}

async function cpuStats(): Promise<{utilization:number}> {
  try {
    if (process.platform==="linux") {
      const {stdout}=await exec("top -bn1 | grep 'Cpu(s)'")
      return {utilization:parseFloat(stdout.match(/(\d+\.?\d*)\s*us/)?.[1]??"0")}
    }
    if (process.platform==="win32") {
      const {stdout}=await exec("wmic cpu get LoadPercentage /VALUE",{timeout:3000})
      return {utilization:+(stdout.match(/LoadPercentage=(\d+)/)?.[1]??"0")}
    }
  } catch {}
  return {utilization:0}
}
