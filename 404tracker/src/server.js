const express = require('express');
const geoip = require('geoip-lite');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8742;

// Init DB
const dbPath = path.join(__dirname, '../data/tracker.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    url TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    city TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_timestamp ON hits(timestamp);
  CREATE INDEX IF NOT EXISTS idx_country ON hits(country_code);
`);

// Prepared statements
const insertHit = db.prepare(
  'INSERT INTO hits (ip, url, country, country_code, city) VALUES (?, ?, ?, ?, ?)'
);

// Helper: anonymize IP preserving digit count
function anonymizeIP(ip) {
  if (!ip) return '***';
  // Replace each digit with *, keep dots and colons
  return ip.replace(/\d/g, '*');
}

// Helper: country code to flag emoji
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

// Log 404 middleware — registered LAST
function log404(req, res, next) {
  // Get real IP (behind proxy/Docker NAT)
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || '0.0.0.0';

  // Strip IPv6 prefix
  const ip = raw.replace(/^::ffff:/, '');

  const url = req.originalUrl;
  const geo = geoip.lookup(ip) || {};

  insertHit.run(ip, url, geo.country || null, geo.country || null, geo.city || null);

  console.log(`[404] ${new Date().toISOString()} | ${ip} | ${url} | ${geo.country || 'Unknown'}`);

  res.status(404).send('Not Found');
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
  const hits = db.prepare(`
    SELECT id, ip, url, country_code, city, timestamp
    FROM hits ORDER BY timestamp DESC LIMIT 200
  `).all();

  const totalHits = db.prepare('SELECT COUNT(*) as c FROM hits').get().c;
  const uniqueIPs  = db.prepare('SELECT COUNT(DISTINCT ip) as c FROM hits').get().c;
  const uniqueURLs = db.prepare('SELECT COUNT(DISTINCT url) as c FROM hits').get().c;

  const topURLs = db.prepare(`
    SELECT url, COUNT(*) as cnt FROM hits GROUP BY url ORDER BY cnt DESC LIMIT 10
  `).all();

  const topCountries = db.prepare(`
    SELECT country_code, COUNT(*) as cnt FROM hits
    WHERE country_code IS NOT NULL
    GROUP BY country_code ORDER BY cnt DESC LIMIT 10
  `).all();

  const hitsPerHour = db.prepare(`
    SELECT strftime('%H', timestamp) as hour, COUNT(*) as cnt
    FROM hits GROUP BY hour ORDER BY hour
  `).all();

  // Enrich hits for display
  const enriched = hits.map(h => ({
    ...h,
    anonIP: anonymizeIP(h.ip),
    digitCount: (h.ip.match(/\d/g) || []).length,
    flag: countryFlag(h.country_code),
    country: h.country_code || 'Unknown',
    timeAgo: timeAgo(h.timestamp),
  }));

  res.send(renderDashboard({ enriched, totalHits, uniqueIPs, uniqueURLs, topURLs, topCountries, hitsPerHour }));
});

// ─── API endpoint for live polling ───────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const since = req.query.since || 0;
  const newHits = db.prepare('SELECT id, ip, url, country_code, city, timestamp FROM hits WHERE id > ? ORDER BY id DESC LIMIT 50').all(since);
  const totalHits = db.prepare('SELECT COUNT(*) as c FROM hits').get().c;
  const uniqueIPs = db.prepare('SELECT COUNT(DISTINCT ip) as c FROM hits').get().c;

  res.json({
    hits: newHits.map(h => ({
      ...h,
      anonIP: anonymizeIP(h.ip),
      digitCount: (h.ip.match(/\d/g) || []).length,
      flag: countryFlag(h.country_code),
    })),
    totalHits,
    uniqueIPs,
    latestId: newHits[0]?.id || since,
  });
});

// ─── Test 404 trigger ─────────────────────────────────────────────────────────
app.get('/trigger-test', (req, res) => {
  // Simulate a few fake hits for demo
  const fakeIPs = ['8.8.8.8','1.1.1.1','185.220.101.45','45.33.32.156','103.21.244.0'];
  const fakeURLs = ['/admin','/wp-login.php','/.env','/secret','/config.yml'];
  fakeIPs.forEach((ip, i) => {
    const geo = geoip.lookup(ip) || {};
    insertHit.run(ip, fakeURLs[i % fakeURLs.length], geo.country || null, geo.country || null, geo.city || null);
  });
  res.send('<pre>Inserted 5 test hits. <a href="/dashboard">View Dashboard</a></pre>');
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// ─── Silence favicon (must be before catch-all) ──────────────────────────────
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ─── Catch-all 404 (must be last) ────────────────────────────────────────────
app.use(log404);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚨 404 Tracker running on http://0.0.0.0:${PORT}`);
  console.log(`   Dashboard → http://localhost:${PORT}/dashboard`);
  console.log(`   Seed test data → http://localhost:${PORT}/trigger-test\n`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function renderDashboard({ enriched, totalHits, uniqueIPs, uniqueURLs, topURLs, topCountries, hitsPerHour }) {
  const maxURL = topURLs[0]?.cnt || 1;
  const maxCountry = topCountries[0]?.cnt || 1;
  const maxHour = Math.max(...hitsPerHour.map(h => h.cnt), 1);

  const hourBars = Array.from({length: 24}, (_, i) => {
    const found = hitsPerHour.find(h => parseInt(h.hour) === i);
    return { hour: i, cnt: found?.cnt || 0 };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 Tracker — Intrusion Map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Teko:wght@300;400;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #080c10;
    --surface: #0d1117;
    --surface2: #161b22;
    --border: #1e2a38;
    --accent: #00ff88;
    --accent2: #ff3366;
    --accent3: #0099ff;
    --text: #c9d1d9;
    --muted: #4a5568;
    --danger: #ff4444;
    --warn: #ffaa00;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Share Tech Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Scan-line overlay */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,255,136,0.015) 2px,
      rgba(0,255,136,0.015) 4px
    );
    pointer-events: none;
    z-index: 9999;
  }

  /* Header */
  header {
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    position: sticky;
    top: 0;
    background: rgba(8,12,16,0.95);
    backdrop-filter: blur(10px);
    z-index: 100;
  }
  .logo {
    font-family: 'Teko', sans-serif;
    font-size: 1.8rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    color: var(--accent);
    text-shadow: 0 0 20px rgba(0,255,136,0.5);
  }
  .logo span { color: var(--accent2); }
  .live-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--accent);
    letter-spacing: 0.1em;
  }
  .live-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(0,255,136,0.4); }
    50% { opacity: 0.7; transform: scale(0.9); box-shadow: 0 0 0 6px rgba(0,255,136,0); }
  }

  /* Layout */
  main { padding: 2rem; max-width: 1400px; margin: 0 auto; }

  /* Stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1.5rem;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--accent);
  }
  .stat-card:nth-child(2)::before { background: var(--accent3); }
  .stat-card:nth-child(3)::before { background: var(--accent2); }
  .stat-label {
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  .stat-value {
    font-family: 'Teko', sans-serif;
    font-size: 3.5rem;
    font-weight: 600;
    line-height: 1;
    color: var(--accent);
  }
  .stat-card:nth-child(2) .stat-value { color: var(--accent3); }
  .stat-card:nth-child(3) .stat-value { color: var(--accent2); }
  .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 4px; }

  /* Two-column analytics */
  .analytics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .panel-header {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-header::before {
    content: '▸';
    color: var(--accent);
  }
  .panel-body { padding: 1.25rem; }

  /* Bar charts */
  .bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 0.75rem;
  }
  .bar-label {
    width: 160px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text);
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--surface2);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 0 8px rgba(0,255,136,0.4);
  }
  .bar-count { color: var(--muted); font-size: 0.7rem; min-width: 30px; text-align: right; }

  /* Hourly chart */
  .hour-chart {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 80px;
    padding-top: 8px;
  }
  .hour-bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
  }
  .hour-bar {
    width: 100%;
    background: var(--accent3);
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    opacity: 0.7;
    transition: opacity 0.2s;
    box-shadow: 0 0 4px rgba(0,153,255,0.3);
  }
  .hour-bar:hover { opacity: 1; }
  .hour-label { font-size: 0.5rem; color: var(--muted); }

  /* Hit table */
  .table-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 2rem;
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  thead th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--surface2);
  }
  tbody tr {
    border-bottom: 1px solid rgba(30,42,56,0.5);
    transition: background 0.15s;
    animation: slideIn 0.3s ease;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  tbody tr:hover { background: rgba(0,255,136,0.03); }
  tbody tr.new-hit { animation: flashNew 2s ease; }
  @keyframes flashNew {
    0% { background: rgba(0,255,136,0.15); }
    100% { background: transparent; }
  }
  td { padding: 0.65rem 1rem; vertical-align: middle; }

  .anon-ip {
    font-family: 'Share Tech Mono', monospace;
    color: var(--accent);
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .digit-badge {
    display: inline-block;
    background: rgba(0,255,136,0.1);
    border: 1px solid rgba(0,255,136,0.2);
    color: var(--accent);
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 6px;
    letter-spacing: 0.05em;
  }
  .url-cell {
    color: var(--accent2);
    font-family: 'Share Tech Mono', monospace;
    max-width: 280px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .flag-cell { font-size: 1.2rem; }
  .country-cell { color: var(--muted); font-size: 0.7rem; letter-spacing: 0.05em; }
  .time-cell { color: var(--muted); font-size: 0.7rem; }
  .city-cell { color: var(--muted); font-size: 0.7rem; }

  /* Status bar */
  footer {
    border-top: 1px solid var(--border);
    padding: 0.5rem 2rem;
    font-size: 0.65rem;
    color: var(--muted);
    letter-spacing: 0.1em;
    display: flex;
    gap: 2rem;
    justify-content: space-between;
  }
  footer span { color: var(--accent); }

  /* Responsive */
  @media (max-width: 900px) {
    .analytics-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<header>
  <div class="logo">404<span>TRACKER</span></div>
  <div class="live-badge">
    <div class="live-dot"></div>
    LIVE MONITORING — AUTO-REFRESH 10s
  </div>
</header>

<main>
  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total 404 Hits</div>
      <div class="stat-value" id="stat-total">${totalHits}</div>
      <div class="stat-sub">all time intrusion attempts</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Unique IPs</div>
      <div class="stat-value" id="stat-ips">${uniqueIPs}</div>
      <div class="stat-sub">distinct sources</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Unique URLs</div>
      <div class="stat-value">${uniqueURLs}</div>
      <div class="stat-sub">paths probed</div>
    </div>
  </div>

  <!-- Analytics -->
  <div class="analytics-grid">
    <div class="panel">
      <div class="panel-header">Top Probed Paths</div>
      <div class="panel-body">
        ${topURLs.map(u => `
          <div class="bar-row">
            <div class="bar-label" title="${u.url}">${u.url}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.round(u.cnt/maxURL*100)}%"></div>
            </div>
            <div class="bar-count">${u.cnt}</div>
          </div>
        `).join('') || '<div style="color:var(--muted);font-size:0.8rem">No data yet</div>'}
      </div>
    </div>
    <div class="panel">
      <div class="panel-header">Top Source Countries</div>
      <div class="panel-body">
        ${topCountries.map(c => `
          <div class="bar-row">
            <div class="bar-label">${countryFlag(c.country_code)} ${c.country_code || 'Unknown'}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${Math.round(c.cnt/maxCountry*100)}%;background:var(--accent3)"></div>
            </div>
            <div class="bar-count">${c.cnt}</div>
          </div>
        `).join('') || '<div style="color:var(--muted);font-size:0.8rem">No geo data yet</div>'}
      </div>
    </div>
  </div>

  <!-- Hourly chart -->
  <div class="panel" style="margin-bottom:2rem">
    <div class="panel-header">Hits by Hour (UTC)</div>
    <div class="panel-body">
      <div class="hour-chart">
        ${hourBars.map(b => `
          <div class="hour-bar-wrap" title="${b.hour}:00 — ${b.cnt} hits">
            <div class="hour-bar" style="height:${Math.round(b.cnt/maxHour*64)}px"></div>
            <div class="hour-label">${String(b.hour).padStart(2,'0')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- Hit log -->
  <div class="table-panel">
    <div class="panel-header" style="padding: 0.75rem 1.25rem;">
      Recent 404 Intrusion Log
    </div>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Anonymized IP</th>
          <th>Flag</th>
          <th>Country</th>
          <th>City</th>
          <th>404'd URL</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody id="hit-tbody">
        ${enriched.map((h, i) => `
          <tr>
            <td style="color:var(--muted)">${h.id}</td>
            <td>
              <span class="anon-ip">${h.anonIP}</span>
              <span class="digit-badge">${h.digitCount} digits</span>
            </td>
            <td class="flag-cell">${h.flag}</td>
            <td class="country-cell">${h.country}</td>
            <td class="city-cell">${h.city || '—'}</td>
            <td class="url-cell" title="${h.url}">${h.url}</td>
            <td class="time-cell">${h.timeAgo}</td>
          </tr>
        `).join('') || `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">
          No 404 hits yet. Try hitting <code style="color:var(--accent)">/anything-random</code>
        </td></tr>`}
      </tbody>
    </table>
    </div>
  </div>
</main>

<footer>
  <div>SYS: 404-TRACKER v1.0 // DB: SQLite // GEO: geoip-lite</div>
  <div>LAST REFRESH: <span id="last-refresh">now</span></div>
  <div>NEXT REFRESH: <span id="next-refresh">10s</span></div>
</footer>

<script>
  let lastId = ${enriched[0]?.id || 0};
  let countdown = 10;

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }

  async function poll() {
    try {
      const res = await fetch('/api/stats?since=' + lastId);
      const data = await res.json();

      document.getElementById('stat-total').textContent = data.totalHits;
      document.getElementById('stat-ips').textContent = data.uniqueIPs;

      if (data.hits.length > 0) {
        const tbody = document.getElementById('hit-tbody');
        // Clear empty state row if present
        const emptyRow = tbody.querySelector('td[colspan]');
        if (emptyRow) emptyRow.closest('tr').remove();

        data.hits.forEach(h => {
          const tr = document.createElement('tr');
          tr.className = 'new-hit';
          tr.innerHTML = \`
            <td style="color:var(--muted)">\${h.id}</td>
            <td><span class="anon-ip">\${h.anonIP}</span><span class="digit-badge">\${h.digitCount} digits</span></td>
            <td class="flag-cell">\${h.flag}</td>
            <td class="country-cell">\${h.country_code || 'Unknown'}</td>
            <td class="city-cell">\${h.city || '—'}</td>
            <td class="url-cell" title="\${h.url}">\${h.url}</td>
            <td class="time-cell">just now</td>
          \`;
          tbody.prepend(tr);
        });
        lastId = data.latestId;
        // Trim to 200 rows
        while (tbody.rows.length > 200) tbody.deleteRow(tbody.rows.length - 1);
      }

      document.getElementById('last-refresh').textContent = new Date().toLocaleTimeString();
    } catch(e) { console.warn('Poll failed', e); }
  }

  setInterval(() => {
    countdown--;
    document.getElementById('next-refresh').textContent = countdown + 's';
    if (countdown <= 0) {
      countdown = 10;
      poll();
    }
  }, 1000);
</script>
</body>
</html>`;
}
