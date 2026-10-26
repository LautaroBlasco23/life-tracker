#!/usr/bin/env node
/**
 * Build the self-contained docs page: docs/index.html.
 *
 * Inlines every markdown source + the vendored marked parser into a single
 * HTML file, so the page works over file:// (no fetch, no server, no deps).
 * `make docs` regenerates and opens it. Markdown stays the source of truth.
 *
 * The page mirrors the app's Warm Minimalism look (styles.md): tokens from
 * packages/shared/src/lib/theme-colors.ts, border-b page header, sidebar nav,
 * sage primary for selected states, light/dark/system toggle like the web app
 * (ThemeContext semantics, localStorage 'theme').
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DOCS_DIR = __dirname;
const OUT = path.join(DOCS_DIR, 'index.html');

// Sidebar order = reading order.
const PAGES = [
  ['getting-started', 'Getting Started'],
  ['architecture', 'Architecture'],
  ['backend', 'Backend'],
  ['data-schemas', 'Data Schemas'],
  ['frontend', 'Frontend'],
  ['mobile', 'Mobile'],
  ['chrome-extension', 'Chrome Extension'],
  ['deployment-modes', 'Deployment Modes'],
  ['styles', 'Styles (UI contract)'],
  ['tests', 'Tests'],
  ['loadtest', 'Load Testing'],
  ['ci-cd', 'CI/CD'],
];

function readMarkdown(slug) {
  // styles.md lives at the repo root; everything else is in docs/.
  const file =
    slug === 'styles' ? path.join(DOCS_DIR, '..', 'styles.md') : path.join(DOCS_DIR, `${slug}.md`);
  const md = fs.readFileSync(file, 'utf8');
  // H1 is rendered as the page heading from the sidebar title; drop a
  // leading "# ..." duplicate to avoid double titles.
  return md.replace(/^# .*\n/, '').trim();
}

const markedSrc = fs.readFileSync(path.join(DOCS_DIR, 'vendor', 'marked.min.js'), 'utf8');
if (markedSrc.toLowerCase().includes('</script')) {
  throw new Error('marked.min.js contains "</script" — cannot inline');
}

const docs = {};
for (const [slug, title] of PAGES) {
  docs[slug] = { title, md: readMarkdown(slug) };
}

// < is escaped so the JSON blob can never close the script tag early.
const payload = JSON.stringify(docs).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Life Tracker — Docs</title>
<script>${markedSrc}</script>
<script id="docs-data" type="application/json">${payload}</script>
<style>
  /* Warm Minimalism tokens — mirrors theme-colors.ts / styles.md */
  :root {
    --background: #F5F2EA;
    --surface: #FFFFFF;
    --surface-elevated: #FFFFFF;
    --foreground: #30372F;
    --muted-foreground: #6A6C61;
    --primary: #5C6F55;
    --primary-foreground: #FFFFFF;
    --secondary: #D6A36D;
    --accent: #E3E7DC;
    --border: #E8E3D8;
    --radius: 12px;
  }
  .dark {
    --background: #1C1D19;
    --surface: #262821;
    --surface-elevated: #33352C;
    --foreground: #F2EFE6;
    --muted-foreground: #AAA99F;
    --primary: #A5B59A;
    --primary-foreground: #1C1D19;
    --secondary: #D8B58A;
    --accent: #2F332A;
    --border: #3A3C33;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--background);
    color: var(--foreground);
    font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  code, pre, .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  }

  /* Page header — the app's shared PageHeader pattern: full-width bar,
     border-b, title + description left, controls right. */
  .page-header {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 12px 20px;
    background: color-mix(in srgb, var(--background) 88%, transparent);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid var(--border);
  }
  .page-header h1 { font-size: 17px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
  .page-header .desc { font-size: 13px; color: var(--muted-foreground); margin: 1px 0 0; }
  .page-header .controls { display: flex; align-items: center; gap: 8px; }

  button.icon {
    height: 36px; min-width: 36px; padding: 0 10px;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--foreground);
    font-size: 13px; cursor: pointer;
  }
  button.icon:hover { background: var(--accent); }

  /* Layout: sidebar + content */
  .shell { display: flex; max-width: 76rem; margin: 0 auto; padding: 0 20px; gap: 32px; }
  nav.toc {
    flex: 0 0 220px; position: sticky; top: 69px;
    max-height: calc(100vh - 69px); overflow-y: auto;
    padding: 20px 0 40px;
  }
  nav.toc .group { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    color: var(--muted-foreground); margin: 18px 8px 6px; }
  nav.toc .group:first-child { margin-top: 0; }
  nav.toc a {
    display: block; padding: 6px 10px; margin: 1px 0;
    border-radius: 8px; color: var(--muted-foreground);
    text-decoration: none; font-size: 13.5px;
  }
  nav.toc a:hover { background: var(--accent); color: var(--foreground); }
  nav.toc a.active { background: var(--accent); color: var(--primary); font-weight: 600; }

  main { flex: 1; min-width: 0; padding: 28px 0 80px; }
  article { max-width: 46rem; }

  /* Markdown typography */
  article h2 { font-size: 21px; font-weight: 650; margin: 2em 0 .5em; letter-spacing: -0.01em;
    padding-top: .5em; }
  article h3 { font-size: 17px; font-weight: 650; margin: 1.6em 0 .4em; }
  article h2, article h3 { scroll-margin-top: 76px; }
  article p, article li { color: var(--foreground); }
  article a { color: var(--primary); text-underline-offset: 3px; }
  article strong { font-weight: 650; }
  article blockquote {
    margin: 1em 0; padding: 10px 16px;
    border-left: 3px solid var(--secondary);
    background: color-mix(in srgb, var(--secondary) 10%, var(--surface));
    border-radius: 0 8px 8px 0; color: var(--muted-foreground);
  }
  article blockquote p { margin: 0; color: var(--foreground); }
  article code {
    font-size: .875em; background: var(--accent); border: 1px solid var(--border);
    padding: 1px 5px; border-radius: 6px;
  }
  article pre {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; overflow-x: auto;
  }
  article pre code { background: none; border: 0; padding: 0; font-size: 13px; }
  article table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 14px; }
  article th, article td { border: 1px solid var(--border); padding: 7px 10px; text-align: left;
    vertical-align: top; }
  article th { background: var(--accent); font-weight: 600; }
  article tr:nth-child(even) td { background: color-mix(in srgb, var(--accent) 35%, var(--surface)); }
  article hr { border: 0; border-top: 1px solid var(--border); margin: 2.5em 0; }
  article ul, article ol { padding-left: 1.4em; }
  article li + li { margin-top: 3px; }
  article h1.page-title { font-size: 28px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
  .page-lead { color: var(--muted-foreground); font-size: 14px; margin: 0 0 1.5em; }
  .page-sep { border-top: 1px solid var(--border); margin: 14px 0 0; padding-top: 14px;
    display: flex; gap: 8px; }
  .page-sep a {
    padding: 6px 12px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--foreground);
    text-decoration: none; font-size: 13px;
  }
  .page-sep a:hover { background: var(--accent); }

  .mobile-only { display: none; }
  @media (max-width: 860px) {
    nav.toc {
      display: none; position: fixed; inset: 69px 0 0 0; flex: none;
      background: var(--background); padding: 20px; z-index: 9;
      max-height: none;
    }
    nav.toc.open { display: block; }
    .mobile-only { display: inline-flex; }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
</style>
</head>
<body>
  <header class="page-header">
    <div>
      <h1>Life Tracker</h1>
      <p class="desc">Monorepo documentation — web, mobile, backend &amp; infra</p>
    </div>
    <div class="controls">
      <button class="icon mobile-only" id="menu" aria-label="Menu">☰ Menu</button>
      <button class="icon" id="theme" aria-label="Toggle theme">◐</button>
    </div>
  </header>

  <div class="shell">
    <nav class="toc" id="toc" aria-label="Docs"></nav>
    <main><article id="content"></article></main>
  </div>

<script>
(function () {
  'use strict';
  var docs = JSON.parse(document.getElementById('docs-data').textContent);
  var slugs = Object.keys(docs);

  // ---- Theme: same semantics as the web app's ThemeContext ----------------
  // preference in localStorage('theme') is 'system' | 'light' | 'dark'.
  // Storage can be unavailable (sandboxed iframes) — degrade to system theme.
  var KEY = 'theme';
  var store = (function () {
    try { localStorage.setItem(KEY, localStorage.getItem(KEY) || 'system'); return localStorage; }
    catch (e) { return { getItem: function () { return 'system'; }, setItem: function () {} }; }
  })();
  function systemDark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }
  function apply(pref) {
    var dark = pref === 'dark' || (pref === 'system' && systemDark());
    document.documentElement.classList.toggle('dark', dark);
  }
  function pref() { return store.getItem(KEY) || 'system'; }
  apply(pref());
  var mq = null;
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
  } catch (e) { /* not available */ }
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function () {
      apply(pref());
    });
  }
  var themeBtn = document.getElementById('theme');
  var ICONS = { system: '◐', light: '☀', dark: '☾' };
  var LABELS = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
  function paintThemeBtn() {
    var p = pref();
    themeBtn.textContent = ICONS[p];
    themeBtn.title = LABELS[p] + ' (click to cycle)';
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
  themeBtn.addEventListener('click', function () {
    var order = ['system', 'light', 'dark'];
    var next = order[(order.indexOf(pref()) + 1) % order.length];
    store.setItem(KEY, next);
    apply(next);
    paintThemeBtn();
  });
  paintThemeBtn();

  // ---- Sidebar ------------------------------------------------------------
  var toc = document.getElementById('toc');
  var GROUPS = [
    ['Start', ['getting-started', 'architecture']],
    ['Apps', ['frontend', 'mobile', 'chrome-extension']],
    ['Backend', ['backend', 'data-schemas']],
    ['Reference', ['deployment-modes', 'styles', 'tests', 'loadtest', 'ci-cd']],
  ];
  var html = '';
  GROUPS.forEach(function (g) {
    html += '<div class="group">' + g[0] + '</div>';
    g[1].forEach(function (slug) {
      html += '<a href="#/' + slug + '" data-slug="' + slug + '">' + docs[slug].title + '</a>';
    });
  });
  toc.innerHTML = html;

  var menuBtn = document.getElementById('menu');
  menuBtn.addEventListener('click', function () { toc.classList.toggle('open'); });

  // ---- Rendering -----------------------------------------------------------
  marked.setOptions({ gfm: true, breaks: false });

  function slugify(text) {
    return text.toLowerCase().replace(/[^\\w]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function render(slug) {
    var doc = docs[slug];
    var body = marked.parse(doc.md);
    var el = document.getElementById('content');
    el.innerHTML = body;

    // Heading ids for deep links.
    el.querySelectorAll('h2, h3').forEach(function (h) {
      if (!h.id) h.id = slugify(h.textContent);
    });

    // Page title comes from the sidebar title (H1s are stripped at build
    // time), so every page gets a stable h1 regardless of its sections.
    var t = document.createElement('h1');
    t.className = 'page-title';
    t.textContent = doc.title;
    el.insertBefore(t, el.firstChild);

    // Links: cross-doc *.md links navigate inside the viewer; everything
    // else renders as inert code-style text (file:// has no repo context).
    el.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (/^https?:\\/\\//i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return; }
      var base = href.split('#')[0].split('/').pop().replace(/\\.md$/i, '');
      var target = null;
      if (slugs.indexOf(base) !== -1) target = base;
      else if (/\\.md$/i.test(href)) {
        // Markdown link to a file that isn't a docs page — degrade to plain text.
        var span = document.createElement('code');
        span.textContent = href.replace(/^\\.?\\//, '');
        a.replaceWith(span);
        return;
      } else {
        // Non-markdown relative link (e.g. repo paths): inert, shown as code.
        var code = document.createElement('code');
        code.textContent = href.replace(/^\\.?\\//, '');
        a.replaceWith(code);
        return;
      }
      if (target) {
        a.setAttribute('href', '#/' + target);
        a.removeAttribute('target');
      }
    });

    // Images (diagrams/) sit next to index.html — relative src works as-is.
    // Prev/next footer.
    var idx = slugs.indexOf(slug);
    var sep = document.createElement('div');
    sep.className = 'page-sep';
    var parts = [];
    if (idx > 0) parts.push('<a href="#/' + slugs[idx - 1] + '">← ' + docs[slugs[idx - 1]].title + '</a>');
    if (idx < slugs.length - 1) parts.push('<a href="#/' + slugs[idx + 1] + '">' + docs[slugs[idx + 1]].title + ' →</a>');
    sep.innerHTML = parts.join('');
    el.appendChild(sep);

    // Sidebar + title state.
    document.querySelectorAll('nav.toc a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-slug') === slug);
    });
    toc.classList.remove('open');
    document.title = doc.title + ' — Life Tracker Docs';
  }

  function route() {
    var slug = (location.hash.match(/^#\\/(.+)$/) || [])[1];
    if (!slug || slugs.indexOf(slug) === -1) slug = slugs[0];
    render(slug);
    if (location.hash !== '#/' + slug) {
      history.replaceState(null, '', '#/' + slug);
    } else {
      window.scrollTo(0, 0);
    }
    // Honor in-page anchors like #/backend#schema (best effort).
    if (location.hash.indexOf('#', 2) !== -1) {
      var anchor = document.getElementById(location.hash.slice(location.hash.indexOf('#', 2) + 1));
      if (anchor) anchor.scrollIntoView();
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`✓ docs/index.html built (${kb} KB) — ${PAGES.length} pages`);
