// Install: npx playwright install chromium
import type { Browser } from "playwright"
let _b: Browser | null = null

async function browser(): Promise<Browser> {
  if (_b?.isConnected()) return _b
  const { chromium } = await import("playwright")
  _b = await chromium.launch({ headless:true, args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] })
  return _b
}
for (const s of ["exit","SIGINT","SIGTERM"]) process.on(s, () => _b?.close().catch(()=>{}))

export async function extractPageText(url: string, max=4000): Promise<string> {
  const b = await browser(), page = await b.newPage()
  try {
    await page.goto(url, { waitUntil:"domcontentloaded", timeout:15_000 })
    await page.evaluate(() => {
      ["script","style","nav","footer","header","aside"].forEach(s =>
        document.querySelectorAll(s).forEach(el=>el.remove()))
    })
    const text = await page.evaluate(() =>
      (document.querySelector("main,article,[role='main']") ?? document.body)?.innerText ?? "")
    return text.replace(/\n{3,}/g,"\n\n").trim().slice(0,max)
  } finally { await page.close() }
}

export async function getWebContext(query: string, maxPages=2): Promise<string|null> {
  if (process.env["WEB_SEARCH_MODE"]==="off") return null
  const q = query.replace(/^\/search\s*/i,"").trim()
  const b = await browser(), page = await b.newPage()
  try {
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&hl=pt-BR`, { waitUntil:"domcontentloaded", timeout:15_000 })
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map(a=>(a as HTMLAnchorElement).href)
        .filter(h=>h.startsWith("http")&&!h.includes("google.com")&&!h.includes("youtube.com"))
        .slice(0,4))
    await page.close()
    const results: string[] = []
    for (const link of links.slice(0,maxPages)) {
      try { const t=await extractPageText(link); if(t.length>100) results.push(`--- ${link} ---\n${t}`) } catch {}
    }
    return results.join("\n\n").slice(0,8000)||null
  } catch(e) { console.error("[playwright]",e); await page.close().catch(()=>{}); return null }
}
