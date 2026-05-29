/**
 * Email service via Resend.com
 * Docs: https://resend.com/docs
 * Free tier: 3,000 emails/month, 100/day
 */

const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? ""
const FROM_EMAIL     = process.env["EMAIL_FROM"]     ?? "noreply@localhost"
const APP_URL        = process.env["APP_URL"]        ?? `http://localhost:${process.env["PORT"] ?? 3000}`

export interface EmailResult {
  ok: boolean
  id?: string
  error?: string
}

async function sendViaResend(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    // Dev fallback — just log to terminal
    console.log(`\n[email] ════════════════════════════════`)
    console.log(`[email] TO:      ${to}`)
    console.log(`[email] SUBJECT: ${subject}`)
    console.log(`[email] (Set RESEND_API_KEY to send real emails)`)
    console.log(`[email] ════════════════════════════════\n`)
    return { ok: true, id: "dev-mode" }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[email] Resend error:", err)
      return { ok: false, error: err }
    }

    const data = await res.json() as { id: string }
    return { ok: true, id: data.id }
  } catch (e) {
    console.error("[email] Send failed:", e)
    return { ok: false, error: String(e) }
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6edf3}
  .wrap{max-width:480px;margin:40px auto;background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden}
  .head{background:linear-gradient(135deg,#1c2128,#21262d);padding:28px 32px;border-bottom:1px solid #30363d;display:flex;align-items:center;gap:12px}
  .logo{width:40px;height:40px;background:linear-gradient(135deg,#58a6ff,#bc8cff);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .brand{font-size:16px;font-weight:700;color:#e6edf3}
  .brand small{display:block;font-size:11px;color:#768390;font-weight:400;margin-top:2px}
  .body{padding:28px 32px}
  h2{font-size:18px;font-weight:700;margin-bottom:10px;color:#e6edf3}
  p{font-size:14px;color:#adbac7;line-height:1.6;margin-bottom:16px}
  .btn{display:inline-block;padding:12px 24px;background:#58a6ff;color:#0d1117;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin:8px 0}
  .code-box{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;margin:16px 0}
  .code{font-family:'Cascadia Code',monospace;font-size:28px;font-weight:700;letter-spacing:8px;color:#58a6ff}
  .footer{padding:16px 32px;border-top:1px solid #30363d;font-size:12px;color:#545d68;text-align:center}
  .warn{background:rgba(210,153,34,.08);border:1px solid rgba(210,153,34,.2);border-radius:6px;padding:10px 14px;font-size:13px;color:#d29922;margin-top:12px}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="logo">🤖</div>
    <div class="brand">Open Neo UI<small>v0.2.1 Alpha 2</small></div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">Open Neo UI · Proxy local de IA · Licença ISC<br>Se você não solicitou este email, ignore-o com segurança.</div>
</div>
</body></html>`
}

// Verification email
export async function sendVerificationEmail(to: string, username: string, token: string): Promise<EmailResult> {
  const link = `${APP_URL}/auth/verify-email?token=${token}`
  const html  = baseTemplate(`
    <h2>Verifique seu email</h2>
    <p>Olá <strong>${username}</strong>, bem-vindo ao Open Neo UI! Clique no botão abaixo para verificar seu endereço de email e ativar sua conta.</p>
    <a href="${link}" class="btn">✓ Verificar email</a>
    <p>Ou copie este link:<br><code style="color:#58a6ff;font-size:12px;word-break:break-all">${link}</code></p>
    <div class="warn">⏱️ Este link expira em <strong>24 horas</strong>.</div>
  `)
  return sendViaResend(to, "Verifique seu email — Open Neo UI", html)
}

// Password reset email
export async function sendPasswordResetEmail(to: string, token: string): Promise<EmailResult> {
  const link = `${APP_URL}/auth/reset-password?token=${token}`
  const html  = baseTemplate(`
    <h2>Redefinir senha</h2>
    <p>Recebemos uma solicitação para redefinir a senha da conta associada a <strong>${to}</strong>.</p>
    <a href="${link}" class="btn">🔑 Redefinir senha</a>
    <p>Ou copie este link:<br><code style="color:#58a6ff;font-size:12px;word-break:break-all">${link}</code></p>
    <div class="warn">⏱️ Este link expira em <strong>1 hora</strong>. Se você não solicitou, ignore este email.</div>
  `)
  return sendViaResend(to, "Redefinir senha — Open Neo UI", html)
}
