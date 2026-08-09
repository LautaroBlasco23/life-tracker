import { DEFAULT_TRACKED_DOMAINS, DEFAULT_API_HOST } from "./config.js";

function buildApiUrl(host) {
  return `http://${host}/api`;
}

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

  try {
    const res = await fetch(`${apiBase}/screen-time/stats?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const statsEl = document.getElementById("stats");

    if (!json.data || json.data.length === 0) {
      statsEl.innerHTML = "<p style='font-size:13px;color:#666'>No visits today.</p>";
      return;
    }
    statsEl.innerHTML = json.data
      .map((s) => `<div class="stat-row"><span>${s.domain}</span><strong>${s.count}</strong></div>`)
      .join("");
  } catch {
    document.getElementById("stats").innerHTML =
      "<p style='font-size:12px;color:#c62828'>Failed to load stats.</p>";
  }
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
  const isTracked = domains.some((d) => hostname.endsWith(d));
  if (isTracked) return;

  const domain = hostname.replace(/^www\./, "");
  const banner = document.getElementById("track-banner");
  banner.innerHTML = `
    <div class="track-banner">
      <span>Not tracking <strong>${domain}</strong></span>
      <button id="track-current-btn">+ Track</button>
    </div>`;

  document.getElementById("track-current-btn").addEventListener("click", async () => {
    const updated = [...domains, domain];
    await chrome.storage.local.set({ trackedDomains: updated });
    banner.innerHTML = "";
    renderDomainsList();
  });
}

async function renderDomainsList() {
  const domains = await getTrackedDomains();
  const listEl = document.getElementById("domains-list");

  if (domains.length === 0) {
    listEl.innerHTML = "<p style='font-size:12px;color:#666'>No domains tracked yet.</p>";
    return;
  }

  listEl.innerHTML = domains
    .map(
      (d) => `<div class="domain-row">
        <span>${d}</span>
        <button class="remove-btn" data-domain="${d}" title="Remove">✕</button>
      </div>`
    )
    .join("");

  listEl.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const updated = domains.filter((d) => d !== btn.dataset.domain);
      await chrome.storage.local.set({ trackedDomains: updated });
      renderDomainsList();
    });
  });
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
    const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
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
