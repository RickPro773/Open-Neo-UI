"""
Open Neo UI — Python Bridge
Handles: OpenAI advanced calls, Gemini, image analysis, embeddings, DALL-E

Run: python bridge.py
Port: 8787 (configurable via PORT env var)
"""

import os, json, base64, asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from urllib.parse import urlencode
from typing import Any

PORT   = int(os.getenv("PORT", "8787"))
SECRET = os.getenv("PYTHON_BRIDGE_SECRET", "")

# ── Provider clients ───────────────────────────────────────────────────────────

def call_openai(task: str, model: str, prompt: str, image_url: str | None = None) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")

    if task == "chat":
        messages = [{"role": "user", "content": prompt}]
        body = {"model": model, "messages": messages, "max_tokens": 2048}

    elif task == "image_analyze":
        if not image_url:
            raise ValueError("image_url required for image_analyze")
        messages = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": image_url}},
            {"type": "text", "text": prompt},
        ]}]
        body = {"model": model or "gpt-4o", "messages": messages, "max_tokens": 1024}

    elif task == "image_gen":
        body = {"model": model or "dall-e-3", "prompt": prompt, "n": 1, "size": "1024x1024"}
        return _post("https://api.openai.com/v1/images/generations", body, api_key, "image_gen")

    elif task == "embed":
        body = {"model": model or "text-embedding-3-small", "input": prompt}
        return _post("https://api.openai.com/v1/embeddings", body, api_key, "embed")

    else:
        raise ValueError(f"Unknown task: {task}")

    return _post("https://api.openai.com/v1/chat/completions", body, api_key, "chat")


def call_gemini(task: str, model: str, prompt: str, image_url: str | None = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    model = model or "gemini-1.5-flash"
    url   = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    parts: list[dict] = [{"text": prompt}]

    if task == "image_analyze" and image_url:
        # Fetch image and convert to base64
        img_data = urlopen(image_url).read()
        b64      = base64.b64encode(img_data).decode()
        mime     = "image/jpeg"  # best guess
        parts = [{"inline_data": {"mime_type": mime, "data": b64}}, {"text": prompt}]

    body = {"contents": [{"parts": parts}]}
    data = _post_raw(url, body)
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _post(url: str, body: dict, api_key: str, extract: str) -> str:
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    req = Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urlopen(req, timeout=60) as res:
            data = json.loads(res.read())
    except HTTPError as e:
        raise RuntimeError(f"API error {e.code}: {e.read().decode()}")

    if extract == "chat":
        return data["choices"][0]["message"]["content"]
    elif extract == "image_gen":
        return data["data"][0]["url"]
    elif extract == "embed":
        return json.dumps(data["data"][0]["embedding"])
    return json.dumps(data)


def _post_raw(url: str, body: dict) -> Any:
    req = Request(url, data=json.dumps(body).encode(),
                  headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=60) as res:
        return json.loads(res.read())


# ── HTTP Handler ───────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[bridge] {fmt % args}")

    def send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"ok": True, "version": "0.1.0"})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        # Auth check
        secret = self.headers.get("X-Bridge-Secret", "")
        if SECRET and secret != SECRET:
            self.send_json(401, {"error": "Unauthorized"})
            return

        if self.path != "/run":
            self.send_json(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body   = json.loads(self.rfile.read(length))

            task      = body.get("task", "chat")
            model     = body.get("model", "")
            prompt    = body.get("prompt", "")
            image_url = body.get("image_url")

            # Route to provider based on model name
            if model.startswith("gemini"):
                result = call_gemini(task, model, prompt, image_url)
            else:
                result = call_openai(task, model, prompt, image_url)

            self.send_json(200, {"result": result})

        except Exception as e:
            print(f"[bridge] Error: {e}")
            self.send_json(500, {"error": str(e)})


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[bridge] Python bridge running on http://localhost:{PORT}")
    print(f"[bridge] OpenAI key: {'✓' if os.getenv('OPENAI_API_KEY') else '✗ not set'}")
    print(f"[bridge] Gemini key: {'✓' if os.getenv('GEMINI_API_KEY') else '✗ not set'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[bridge] Stopped")
