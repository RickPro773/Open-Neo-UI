// FIX: era "neotek" (nome do preload original), agora "neo" — consistente com preload.ts
declare const neo: {
  tab: {
    create:    (o: { title?: string; url?: string; icon?: string }) => Promise<number>;
    activate:  (id: number)  => Promise<void>;
    close:     (id: number)  => Promise<void>;
    reload:    (id: number)  => Promise<void>;
    stop:      (id: number)  => Promise<void>;
    goBack:    (id: number)  => Promise<void>;
    goForward: (id: number)  => Promise<void>;
    list:      ()            => Promise<any[]>;
    devtools:  (id: number)  => Promise<void>;
  };
  system: {
    servicesHealth: () => Promise<any[]>;
    memory:         () => Promise<{ pct: number; used: number; total: number }>;
  };
  window: { minimize: () => void; maximize: () => void; close: () => void; };
  sidebar: { toggle: () => void; };
  on:  (ch: string, fn: (...a: any[]) => void) => void;
};

// ── Estado ─────────────────────────────────────────────────
let activeTabId: number | null = null;

// FIX: era "tabs-container" no renderer, mas o HTML sempre teve "tabs-list"
const tabsList    = document.getElementById("tabs-list")!;
const urlBar      = document.getElementById("url-bar") as HTMLInputElement;
const statusDot   = document.getElementById("status-dot")!;
const statusPanel = document.getElementById("status-panel")!;
const servicesList= document.getElementById("services-list")!;
const memFill     = document.getElementById("mem-fill")!;
const memPct      = document.getElementById("mem-pct")!;
const navBack     = document.getElementById("nav-back")    as HTMLButtonElement;
const navFwd      = document.getElementById("nav-forward") as HTMLButtonElement;

// ── Ícones SVG por tipo ─────────────────────────────────────
const ICONS: Record<string, string> = {
  chat:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 10.667A1.333 1.333 0 0 1 12.667 12H4.667L2 14.667V3.333A1.333 1.333 0 0 1 3.333 2h9.334A1.333 1.333 0 0 1 14 3.333z"/></svg>`,
  terminal: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,11.5 7,8 3,4.5"/><line x1="8" y1="11.5" x2="13" y2="11.5"/></svg>`,
  tools:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.8 4.2a1 1 0 0 0 0 .9l1 1.1a1 1 0 0 0 .9 0l2.5-2.5a4 4 0 0 1-5.3 5.3L4.6 13.3a1.4 1.4 0 0 1-2-2L7 6.9a4 4 0 0 1 5.3-5.3L9.8 4.2z"/></svg>`,
  shield:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.333L2 4v4.667C2 12.533 4.667 15.187 8 16c3.333-.813 6-3.467 6-7.333V4L8 1.333z"/></svg>`,
  bolt:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="9,1.5 3,9.5 8,9.5 7,14.5 13,6.5 8,6.5"/></svg>`,
  python:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8"/><circle cx="8" cy="10.5" r="0.75" fill="currentColor"/></svg>`,
  db:       `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="8" cy="4.5" rx="5.5" ry="2"/><path d="M2.5 4.5v7C2.5 12.88 5.02 14 8 14s5.5-1.12 5.5-2.5v-7"/><path d="M2.5 8c0 1.38 2.52 2.5 5.5 2.5S13.5 9.38 13.5 8"/></svg>`,
  globe:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="2.5" ry="6.5"/><line x1="1.5" y1="8" x2="14.5" y2="8"/></svg>`,
};

function getIcon(k: string): string { return ICONS[k] ?? ICONS.globe; }
function sanitize(s: string): string { return s.replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ── Construir elemento de aba ──────────────────────────────
function buildTab(id: number, title: string, icon: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tab";
  el.dataset.id = String(id);
  el.innerHTML = `
    <span class="tab-icon">${getIcon(icon)}</span>
    <div  class="tab-spinner"></div>
    <span class="tab-title">${sanitize(title)}</span>
    <button class="tab-close" title="Fechar aba">
      <svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.4">
        <line x1="1" y1="1" x2="9" y2="9"/>
        <line x1="9" y1="1" x2="1" y2="9"/>
      </svg>
    </button>`;

  el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".tab-close")) return;
    neo.tab.activate(id);
  });
  el.querySelector(".tab-close")!.addEventListener("click", (e) => {
    e.stopPropagation();
    neo.tab.close(id);
  });
  return el;
}

// ── Eventos do main process ────────────────────────────────

// FIX: canais eram "tab-created" etc. (hífens), agora "tab:created" (dois-pontos) — alinhado com main.ts
neo.on("tab:created", ({ id, title, icon }: any) => {
  tabsList.appendChild(buildTab(id, title, icon));
});

neo.on("tab:activated", ({ id, canGoBack, canGoForward }: any) => {
  activeTabId = id;
  document.querySelectorAll<HTMLElement>(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.id === String(id))
  );
  navBack.disabled = !canGoBack;
  navFwd.disabled  = !canGoForward;
  // Atualiza sidebar: marca botão ativo se URL bate
  syncSidebarActive();
});

neo.on("tab:updated", ({ id, title }: any) => {
  const el = tabsList.querySelector(`[data-id="${id}"] .tab-title`);
  if (el) el.textContent = title;
});

neo.on("tab:closed",  ({ id }: any) => {
  tabsList.querySelector(`[data-id="${id}"]`)?.remove();
  if (tabsList.children.length === 0) activeTabId = null;
});

neo.on("tab:loading", ({ id, loading }: any) => {
  tabsList.querySelector(`[data-id="${id}"]`)?.classList.toggle("loading", loading);
});

neo.on("tab:nav-state", ({ id, canGoBack, canGoForward }: any) => {
  if (id === activeTabId) {
    navBack.disabled = !canGoBack;
    navFwd.disabled  = !canGoForward;
  }
});

neo.on("sidebar:state", ({ pinned }: any) => {
  document.getElementById("sidebar")!.classList.toggle("collapsed", !pinned);
});

// ── Controles de janela ────────────────────────────────────
document.getElementById("btn-min")!  .addEventListener("click", () => neo.window.minimize());
document.getElementById("btn-max")!  .addEventListener("click", () => neo.window.maximize());
document.getElementById("btn-close")!.addEventListener("click", () => neo.window.close());

// ── Nova aba ───────────────────────────────────────────────
document.getElementById("btn-new-tab")!.addEventListener("click", () =>
  neo.tab.create({ title: "Nova aba", url: "http://localhost:3000", icon: "chat" })
);

// ── Navbar ─────────────────────────────────────────────────
navBack.disabled = true;
navFwd.disabled  = true;

navBack.addEventListener("click", () => activeTabId && neo.tab.goBack(activeTabId));
navFwd .addEventListener("click", () => activeTabId && neo.tab.goForward(activeTabId));
document.getElementById("nav-reload")!  .addEventListener("click", () => activeTabId && neo.tab.reload(activeTabId));
document.getElementById("nav-devtools")!.addEventListener("click", () => activeTabId && neo.tab.devtools(activeTabId!));

urlBar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  let url = urlBar.value.trim();
  if (!url) return;
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://" + url;
  neo.tab.create({ title: "...", url, icon: "globe" });
  urlBar.value = "";
  urlBar.blur();
});

// ── Sidebar botões ─────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>(".sb-btn[data-url]").forEach((btn) => {
  btn.addEventListener("click", () =>
    neo.tab.create({
      title: btn.dataset.title ?? "Nova aba",
      url:   btn.dataset.url!,
      icon:  btn.dataset.icon ?? "globe",
    })
  );
});

document.getElementById("sb-terminal")?.addEventListener("click", () =>
  neo.tab.create({ title: "Terminal", url: "neo://terminal", icon: "terminal" })
);

document.getElementById("sb-sidebar-toggle")?.addEventListener("click", () =>
  neo.sidebar.toggle()
);

// ── Marcar botão sidebar ativo ─────────────────────────────
const SB_URLS: Record<string, string> = {
  "sb-chat":    "http://localhost:3000",
  "sb-mcp":     "http://localhost:8000/docs",
  "sb-gateway": "http://localhost:8080/health",
  "sb-go":      "http://localhost:9090/health",
  "sb-python":  "http://localhost:8000/docs",
};

function syncSidebarActive() {
  // Simples: marca o botão cujo data-url coincide com última aba ativa (best-effort)
  Object.entries(SB_URLS).forEach(([id]) => {
    document.getElementById(id)?.classList.remove("active");
  });
}

// ── Status panel ───────────────────────────────────────────
document.getElementById("sb-status")!.addEventListener("click", (e) => {
  e.stopPropagation();
  statusPanel.classList.toggle("hidden");
  if (!statusPanel.classList.contains("hidden")) refreshStatus();
});

document.getElementById("status-close")!.addEventListener("click", () =>
  statusPanel.classList.add("hidden")
);

document.addEventListener("click", (e) => {
  if (!statusPanel.contains(e.target as Node) &&
      !(e.target as HTMLElement).closest("#sb-status")) {
    statusPanel.classList.add("hidden");
  }
});

async function refreshStatus() {
  const services = await neo.system.servicesHealth();
  servicesList.innerHTML = "";
  let okCount = 0;

  services.forEach((s: any) => {
    if (s.online) okCount++;
    const row = document.createElement("div");
    row.className = "service-row";
    row.innerHTML = `
      <span class="svc-dot ${s.online ? "online" : "offline"}"></span>
      <span class="svc-name">${sanitize(s.name)}</span>
      <span class="svc-status">${s.online ? "online" : "offline"}</span>`;
    servicesList.appendChild(row);
  });

  updateStatusDot(okCount, services.length);

  const mem = await neo.system.memory();
  memFill.style.width = mem.pct + "%";
  memPct.textContent  = mem.pct + "%";
}

function updateStatusDot(ok: number, total: number) {
  statusDot.className = "status-dot " + (ok === total ? "ok" : ok > 0 ? "partial" : "error");
}

// Atualizar dot silenciosamente a cada 15s
setInterval(async () => {
  if (statusPanel.classList.contains("hidden")) {
    const s = await neo.system.servicesHealth();
    updateStatusDot(s.filter((x: any) => x.online).length, s.length);
  }
}, 15_000);

// Kick inicial (aguarda main terminar de montar)
setTimeout(async () => {
  const s = await neo.system.servicesHealth();
  updateStatusDot(s.filter((x: any) => x.online).length, s.length);
}, 2500);
