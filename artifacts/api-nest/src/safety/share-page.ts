/** Public live trip status page (/api/share/:token). Polls the JSON endpoint every 10 seconds. */
export function renderSharePage(token: string): string {
  const safeToken = token.replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Live trip status · Rideshare Chats</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  :root { --bg:#F8FAFC; --fg:#0B0F19; --muted:#64748B; --card:#FFFFFF; --border:#E2E8F0; --primary:#C91A25; --accent:#10B981; --warn:#D97706; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:var(--bg); color:var(--fg); }
  header { padding:16px; display:flex; align-items:center; gap:10px; }
  header b { font-size:16px; }
  header span { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--primary); font-weight:700; }
  main { max-width:560px; margin:0 auto; padding:0 16px 24px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:20px; padding:16px; margin-bottom:12px; }
  .row { display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:14px; }
  .muted { color:var(--muted); font-size:13px; }
  .pill { display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  #map { height:320px; border-radius:16px; border:1px solid var(--border); }
  h1 { font-size:22px; margin:4px 0 6px; }
</style>
</head>
<body>
<header><b>Rideshare Chats</b><span>Live trip status</span></header>
<main>
  <div class="card">
    <div class="muted">Sharing trip status for</div>
    <h1 id="name">Loading…</h1>
    <div class="row"><span class="muted">Trip state</span><span id="state" class="pill">—</span></div>
    <div class="row" style="margin-top:8px"><span class="muted">Speed</span><b id="speed">—</b></div>
    <div class="row" style="margin-top:8px"><span class="muted">Last update</span><b id="updated">—</b></div>
  </div>
  <div id="map"></div>
  <p class="muted" id="expiry" style="margin-top:12px"></p>
  <p class="muted">If you believe this person is in danger, call your local emergency number.</p>
</main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var token = ${JSON.stringify(safeToken)};
  var map = L.map('map', { zoomControl: true }).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var marker = null, circle = null, centered = false;
  var LABELS = { VERIFIED: ['In transit', '#10B981'], GRACE: ['Stopped (traffic)', '#D97706'], PENDING: ['Verifying ride', '#64748B'], TERMINATED: ['Session ended', '#C91A25'] };
  function ago(iso) { if (!iso) return '—'; var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? s + 's ago' : Math.round(s / 60) + ' min ago'; }
  function load() {
    fetch('/api/v1/public/share/' + encodeURIComponent(token)).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); }).then(function (res) {
      var d = res.b;
      if (!res.ok) { document.getElementById('name').textContent = 'Link not found'; return; }
      document.getElementById('name').textContent = d.riderName;
      var label = d.active ? (LABELS[d.state] || ['Unknown', '#64748B']) : ['Link expired', '#64748B'];
      var el = document.getElementById('state'); el.textContent = label[0]; el.style.background = label[1] + '22'; el.style.color = label[1];
      document.getElementById('speed').textContent = d.speedMph != null ? d.speedMph + ' mph' : '—';
      document.getElementById('updated').textContent = ago(d.updatedAt);
      document.getElementById('expiry').textContent = d.active ? 'This link expires ' + new Date(d.expiresAt).toLocaleString() + '.' : 'This link has expired.';
      if (d.location) {
        var ll = [d.location.lat, d.location.lng];
        if (!marker) { marker = L.marker(ll).addTo(map); circle = L.circle(ll, { radius: d.location.accuracyM || 20, color: '#C91A25' }).addTo(map); }
        marker.setLatLng(ll); circle.setLatLng(ll); circle.setRadius(d.location.accuracyM || 20);
        if (!centered) { map.setView(ll, 15); centered = true; }
      }
    }).catch(function () {});
  }
  load(); setInterval(load, 10000);
</script>
</body>
</html>`;
}
