import { chromium, type Browser } from "playwright"

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })
  }
  return browser
}

process.on("exit",   () => browser?.close())
process.on("SIGTERM",() => browser?.close())
process.on("SIGINT", () => browser?.close())

async function extractText(url: string): Promise<string> {
  const b = await getBrowser()
  const page = await b.newPage()
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 })
    await page.evaluate(() => {
      ["script","style","nav","footer","header","aside"].forEach(s =>
        document.querySelectorAll(s).forEach(el => el.remove())
      )
    })
    const text = await page.evaluate(() =>
      (document.querySelector("main") ?? document.body)?.innerText ?? ""
    )
    return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000)
  } finally {
    await page.close()
  }
}

export async function getWebContext(query: string): Promise<string | null> {
  try {
    const q = query.replace(/^\/search\s*/i, "").trim()
    const b = await getBrowser()
    const page = await b.newPage()

    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(q)}&hl=pt-BR`, {
      waitUntil: "domcontentloaded", timeout: 15_000
    })

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(h => h.startsWith("http") && !h.includes("google.com") && !h.includes("youtube.com"))
        .slice(0, 3)
    )
    await page.close()

    const results: string[] = []
    for (const link of links) {
      try {
        const text = await extractText(link)
        if (text.length > 100) results.push(`--- ${link} ---\n${text}`)
      } catch { /* ignora */ }
    }

    return results.join("\n\n").slice(0, 8000) || null
  } catch (err) {
    console.error("[playwright]", (err as Error).message)
    return null
  }
}
