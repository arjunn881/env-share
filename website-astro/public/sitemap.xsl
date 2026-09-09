<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  exclude-result-prefixes="sitemap image video news">

  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Sitemap — share-env</title>
        <meta name="robots" content="noindex, follow"/>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
        <link rel="shortcut icon" href="/favicon.ico"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
        <style>
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #030912;
            --bg-card: rgba(255,255,255,.04);
            --border: rgba(255,255,255,.08);
            --accent: #00ffb3;
            --accent-2: #a78bfa;
            --text: #e8eaf0;
            --text-muted: #8892a4;
            --text-dim: #4a5568;
            --r: 10px;
          }
          html { scroll-behavior: smooth; }
          body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            min-height: 100vh;
          }
          /* Gradient background */
          body::before {
            content: '';
            position: fixed;
            inset: 0;
            background:
              radial-gradient(ellipse 80% 50% at 20% 0%, rgba(99,102,241,.12) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 80% 100%, rgba(0,255,179,.07) 0%, transparent 60%);
            pointer-events: none;
            z-index: 0;
          }
          .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

          /* Nav */
          nav {
            border-bottom: 1px solid var(--border);
            background: rgba(3,9,18,.8);
            backdrop-filter: blur(16px);
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .nav-inner {
            max-width: 960px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            gap: 12px;
            height: 56px;
          }
          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            color: var(--text);
            font-weight: 700;
            font-size: .95rem;
          }
          .logo svg { color: var(--accent); }
          .logo-text { color: var(--accent); }
          .nav-badge {
            margin-left: auto;
            background: rgba(0,255,179,.1);
            border: 1px solid rgba(0,255,179,.2);
            color: var(--accent);
            font-size: .68rem;
            font-weight: 700;
            letter-spacing: .08em;
            text-transform: uppercase;
            padding: 3px 10px;
            border-radius: 999px;
          }

          /* Hero */
          .hero {
            padding: 56px 0 40px;
          }
          .hero-label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: .72rem;
            font-weight: 700;
            letter-spacing: .12em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 14px;
          }
          .hero-label::before {
            content: '';
            display: block;
            width: 24px;
            height: 2px;
            background: var(--accent);
            border-radius: 2px;
          }
          .hero h1 {
            font-size: clamp(1.8rem, 4vw, 2.6rem);
            font-weight: 800;
            letter-spacing: -1px;
            line-height: 1.1;
            margin-bottom: 12px;
          }
          .hero h1 span { color: var(--accent); }
          .hero p {
            color: var(--text-muted);
            font-size: .95rem;
            max-width: 560px;
          }

          /* Stats */
          .stats {
            display: flex;
            gap: 32px;
            margin: 28px 0;
            flex-wrap: wrap;
          }
          .stat { display: flex; flex-direction: column; gap: 2px; }
          .stat-num {
            font-size: 1.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, #6366f1, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .stat-label { font-size: .72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }

          /* Search */
          .search-wrap {
            margin-bottom: 20px;
          }
          .search-input {
            width: 100%;
            max-width: 480px;
            padding: 10px 16px 10px 40px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: .9rem;
            font-family: inherit;
            outline: none;
            transition: border-color .2s;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: 12px center;
          }
          .search-input:focus { border-color: rgba(99,102,241,.5); }
          .search-input::placeholder { color: var(--text-dim); }

          /* Table */
          .table-wrap {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--r);
            overflow: hidden;
            margin-bottom: 48px;
          }
          .table-head {
            display: grid;
            grid-template-columns: 1fr 140px 100px;
            padding: 10px 20px;
            background: rgba(255,255,255,.03);
            border-bottom: 1px solid var(--border);
            font-size: .7rem;
            font-weight: 700;
            letter-spacing: .1em;
            text-transform: uppercase;
            color: var(--text-muted);
          }
          .url-row {
            display: grid;
            grid-template-columns: 1fr 140px 100px;
            padding: 12px 20px;
            border-bottom: 1px solid rgba(255,255,255,.04);
            align-items: center;
            transition: background .15s;
            text-decoration: none;
            color: inherit;
          }
          .url-row:last-child { border-bottom: none; }
          .url-row:hover { background: rgba(255,255,255,.03); }
          .url-link {
            color: var(--accent-2);
            font-size: .85rem;
            font-family: 'JetBrains Mono', monospace;
            text-decoration: none;
            word-break: break-all;
            transition: color .15s;
          }
          .url-link:hover { color: var(--accent); }
          .url-date, .url-freq, .url-prio {
            font-size: .78rem;
            color: var(--text-muted);
          }
          .prio-high { color: #00ffb3; }
          .prio-med  { color: #a78bfa; }
          .prio-low  { color: var(--text-dim); }

          /* Footer */
          footer {
            border-top: 1px solid var(--border);
            padding: 28px 0;
            text-align: center;
            font-size: .78rem;
            color: var(--text-dim);
          }
          footer a { color: var(--accent); text-decoration: none; }
          footer a:hover { text-decoration: underline; }

          @media (max-width: 600px) {
            .table-head, .url-row { grid-template-columns: 1fr; }
            .url-date, .url-freq { display: none; }
            .table-head span:not(:first-child) { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- Nav -->
        <nav>
          <div class="nav-inner">
            <a href="/" class="logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m9 8-3 4 3 4"/>
                <path d="m15 8 3 4-3 4"/>
              </svg>
              <span class="logo-text">share-env</span>
            </a>
            <span class="nav-badge">XML Sitemap</span>
          </div>
        </nav>

        <div class="wrap">
          <!-- Hero -->
          <div class="hero">
            <p class="hero-label">Site Map</p>
            <h1>All <span>share-env</span> Pages</h1>
            <p>Complete index of all public pages — used by search engines to crawl and index this site.</p>

            <div class="stats">
              <div class="stat">
                <span class="stat-num" id="urlCount">—</span>
                <span class="stat-label">Indexed URLs</span>
              </div>
              <div class="stat">
                <span class="stat-num">XML</span>
                <span class="stat-label">Format</span>
              </div>
              <div class="stat">
                <span class="stat-num">v0.9</span>
                <span class="stat-label">Sitemap spec</span>
              </div>
            </div>

            <div class="search-wrap">
              <input
                type="search"
                class="search-input"
                id="urlSearch"
                placeholder="Filter URLs…"
                oninput="filterUrls(this.value)"
                autocomplete="off"
              />
            </div>
          </div>

          <!-- URL Table -->
          <div class="table-wrap" id="tableWrap">
            <div class="table-head">
              <span>URL</span>
              <span>Last Modified</span>
              <span>Priority</span>
            </div>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <xsl:sort select="sitemap:priority" order="descending" data-type="number"/>
              <div class="url-row">
                <a class="url-link" href="{sitemap:loc}">
                  <xsl:value-of select="sitemap:loc"/>
                </a>
                <span class="url-date">
                  <xsl:value-of select="substring(sitemap:lastmod,1,10)"/>
                </span>
                <span>
                  <xsl:attribute name="class">
                    <xsl:choose>
                      <xsl:when test="sitemap:priority &gt;= 0.8">url-prio prio-high</xsl:when>
                      <xsl:when test="sitemap:priority &gt;= 0.5">url-prio prio-med</xsl:when>
                      <xsl:otherwise>url-prio prio-low</xsl:otherwise>
                    </xsl:choose>
                  </xsl:attribute>
                  <xsl:value-of select="sitemap:priority"/>
                </span>
              </div>
            </xsl:for-each>
          </div>
        </div>

        <!-- Footer -->
        <footer>
          <p>
            <a href="/">share-env</a> ·
            <a href="/robots.txt">robots.txt</a> ·
            <a href="/sitemap.xml">sitemap.xml</a>
            — Generated by <a href="https://www.npmjs.com/package/share-env" target="_blank" rel="noopener">share-env</a>
          </p>
        </footer>

        <script>
          // Count URLs and update stat
          document.addEventListener('DOMContentLoaded', function() {
            var rows = document.querySelectorAll('.url-row');
            document.getElementById('urlCount').textContent = rows.length;
          });

          // Filter URLs
          function filterUrls(query) {
            var q = query.toLowerCase();
            document.querySelectorAll('.url-row').forEach(function(row) {
              var link = row.querySelector('.url-link');
              if (link) {
                row.style.display = link.textContent.toLowerCase().includes(q) ? '' : 'none';
              }
            });
          }
        </script>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
