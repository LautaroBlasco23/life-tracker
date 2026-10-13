import { DEFAULT_TRACKED_DOMAINS, DEFAULT_API_HOST } from "./config.js";
import { buildApiUrl, isTrackedHost, normalizeDomainInput } from "./lib/tracker.js";

async function getApiHost() {
  const { apiHost } = await chrome.storage.local.get("apiHost");
  return apiHost || DEFAULT_API_HOST;
}

async function getApiBase() {
  const host = await getApiHost();
  return buildApiUrl(host);
}

async function getTrackedDomains() {
  const { trackedDomains } = await chrome.storage.local.get("trackedDomains");
  return trackedDomains || DEFAULT_TRACKED_DOMAINS;
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg ${type}`;
  setTimeout(() => (el.textContent = ""), 2500);
}

function showLoginMsg(text, type) {
  const el = document.getElementById("login-msg");
  el.textContent = text;
  el.className = `login-msg show ${type}`;
}

function clearLoginMsg() {
  const el = document.getElementById("login-msg");
  el.textContent = "";
  el.className = "login-msg";
}

function setLoginLoading(loading) {
  const btn = document.getElementById("login-btn");
  if (loading) {
    btn.classList.add("btn-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
  }
}

async function renderStats(token) {
  const apiBase = await getApiBase();
  const today = new Date().toISOString().split("T")[0];

  // Stats are rendered via DOM APIs (textContent), never innerHTML: server
  // values (domain) could otherwise inject markup into this privileged page.
  try {
    const res = await fetch(`${apiBase}/screen-time/stats?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const statsEl = document.getElementById("stats");
    statsEl.textContent = "";

    if (!json.data || json.data.length === 0) {
      appendEmptyMessage(statsEl, "No visits today.", { fontSize: "13px", color: "#666" });
      return;
    }
    for (const s of json.data) {
      const row = document.createElement("div");
      row.className = "stat-row";
      const label = document.createElement("span");
      label.textContent = s.domain;
      const count = document.createElement("strong");
      count.textContent = s.count;
      row.append(label, count);
      statsEl.appendChild(row);
    }
  } catch {
    document.getElementById("stats").textContent = "";
    appendEmptyMessage(document.getElementById("stats"), "Failed to load stats.", {
      fontSize: "12px",
      color: "#c62828",
    });
  }
}

function appendEmptyMessage(container, text, opts) {
  const p = document.createElement("p");
  p.style.fontSize = opts?.fontSize || "13px";
  p.style.color = opts?.color || "#666";
  p.textContent = text;
  container.appendChild(p);
}

async function renderTrackBanner() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  let hostname;
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return;
  }

  const domains = await getTrackedDomains();
  const isTracked = isTrackedHost(hostname, domains);
  if (isTracked) return;

  const domain = hostname.replace(/^www\./, "");
  const banner = document.getElementById("track-banner");
  banner.textContent = "";

  const box = document.createElement("div");
  box.className = "track-banner";
  const label = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = domain;
  label.textContent = "Not tracking ";
  label.appendChild(strong);
  const btn = document.createElement("button");
  btn.id = "track-current-btn";
  btn.textContent = "+ Track";
  box.append(label, btn);
  banner.appendChild(box);

  btn.addEventListener("click", async () => {
    const updated = [...domains, domain];
    await chrome.storage.local.set({ trackedDomains: updated });
    banner.textContent = "";
    renderDomainsList();
  });
}

async function renderDomainsList() {
  const domains = await getTrackedDomains();
  const listEl = document.getElementById("domains-list");
  listEl.textContent = "";

  if (domains.length === 0) {
    appendEmptyMessage(listEl, "No domains tracked yet.", { fontSize: "12px", color: "#666" });
    return;
  }

  // textContent + createElement only: stored domains are user-entered and
  // never sanitized for HTML, so they must not pass through innerHTML.
  for (const d of domains) {
    const row = document.createElement("div");
    row.className = "domain-row";
    const label = document.createElement("span");
    label.textContent = d;
    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.textContent = "✕";
    remove.title = "Remove";
    remove.dataset.domain = d;
    remove.addEventListener("click", async () => {
      const current = await getTrackedDomains();
      const updated = current.filter((x) => x !== remove.dataset.domain);
      await chrome.storage.local.set({ trackedDomains: updated });
      renderDomainsList();
    });
    row.append(label, remove);
    listEl.appendChild(row);
  }
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

async function showApp(token) {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  setupTabs();
  renderStats(token);
  renderTrackBanner();
  renderDomainsList();
  const host = await getApiHost();
  document.getElementById("current-api-host").textContent = host;
}

document.addEventListener("DOMContentLoaded", async () => {
  const { token } = await chrome.storage.local.get("token");
  if (token) {
    await showApp(token);
  } else {
    const host = await getApiHost();
    document.getElementById("api-host").value = host;
  }

  async function handleLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const host = document.getElementById("api-host").value.trim() || DEFAULT_API_HOST;
    const apiBase = buildApiUrl(host);

    if (!email || !password) {
      showLoginMsg("Please enter both email and password", "err");
      return;
    }

    // Remote (https) hosts need an explicit user-granted host permission:
    // the manifest no longer asks for <all_urls>. Local dev hosts are
    // pre-granted. Denial is non-fatal — it only matters for servers
    // without permissive CORS.
    if (apiBase.startsWith("https://")) {
      const origin = new URL(apiBase).origin + "/*";
      const granted =
        (await chrome.permissions.contains({ origins: [origin] })) ||
        (await chrome.permissions.request({ origins: [origin] }));
      if (!granted) {
        showLoginMsg("Remote tracking may not work without host permission.", "err");
      }
    }

    clearLoginMsg();
    setLoginLoading(true);

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          showLoginMsg("Invalid email or password. Please try again.", "err");
        } else if (res.status === 404) {
          showLoginMsg("Login endpoint not found. Check your backend URL.", "err");
        } else {
          showLoginMsg(`Login failed (Error ${res.status}). Please try again.`, "err");
        }
        setLoginLoading(false);
        return;
      }

      const json = await res.json();
      const accessToken = json.data?.accessToken;
      if (!accessToken) {
        showLoginMsg("Login failed. No access token received from server.", "err");
        setLoginLoading(false);
        return;
      }

      await chrome.storage.local.set({ token: accessToken, apiHost: host });
      showLoginMsg("Login successful! Loading your data...", "ok");
      setTimeout(async () => {
        clearLoginMsg();
        setLoginLoading(false);
        await showApp(accessToken);
      }, 800);
    } catch (err) {
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        showLoginMsg("Cannot connect to server. Check your backend URL and try again.", "err");
      } else {
        showLoginMsg("Network error. Please check your connection and try again.", "err");
      }
      setLoginLoading(false);
    }
  }

  document.getElementById("login-btn").addEventListener("click", handleLogin);

  document.getElementById("login-section").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.getElementById("login-section").style.display !== "none") {
      e.preventDefault();
      handleLogin();
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("token");
    document.getElementById("app-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
    const host = await getApiHost();
    document.getElementById("api-host").value = host;
    showLoginMsg("You have been logged out successfully.", "ok");
  });

  document.getElementById("add-domain-btn").addEventListener("click", async () => {
    const input = document.getElementById("new-domain");
    const domain = normalizeDomainInput(input.value);
    if (!domain) return;

    const domains = await getTrackedDomains();
    if (domains.includes(domain)) {
      showMsg("sites-msg", "Already tracked.", "err");
      return;
    }

    await chrome.storage.local.set({ trackedDomains: [...domains, domain] });
    input.value = "";
    showMsg("sites-msg", `Added ${domain}`, "ok");
    renderDomainsList();
  });

  document.getElementById("save-settings-btn").addEventListener("click", async () => {
    document.getElementById("app-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    const host = await getApiHost();
    document.getElementById("api-host").value = host;
    clearLoginMsg();
    showLoginMsg("You can now edit the backend URL below.", "ok");
  });
});
