// widgets.js — right rail + menu bar + dock + launchpad + spotlight
const Widgets = (() => {
  let lastSnap = null, lastHealth = {}, lastSummary = { healthy: 0, configured: 0, unhealthy: 0 };
  let lastWeather = null;

  // ---------- clock ----------
  function tickClock() {
    const now = new Date();
    const dEl = document.getElementById('mb-date');
    const tEl = document.getElementById('mb-time');
    if (dEl) dEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (tEl) tEl.textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // ---------- main poll ----------
  async function refresh() {
    try {
      const data = await API.get('/api/system');
      lastSnap = data; lastHealth = data.health || {}; lastSummary = data.summary || lastSummary;
      const s = data.system;

      const days = Math.floor(s.uptime_sec / 86400);
      const hrs = Math.floor((s.uptime_sec % 86400) / 3600);
      const mins = Math.floor((s.uptime_sec % 3600) / 60);
      document.getElementById('uptime-big').innerHTML =
        (days ? `<span class="d">${days}</span><span class="u">d</span>` : '') + hrs + '<span class="u">h</span>' + mins + '<span class="u">m</span>';
      document.getElementById('w-os').textContent = (s.hostname || '') + ' · ' + s.os + '/' + s.arch;

      setBar('bar-cpu', s.cpu_pct);
      document.getElementById('m-cpu').textContent = (s.cpu_pct || 0).toFixed(0) + '%';
      const ramPct = s.mem_total ? 100 * s.mem_used / s.mem_total : 0;
      setBar('bar-ram', ramPct);
      document.getElementById('m-ram').textContent = `${(s.mem_used / 1e9).toFixed(1)} / ${(s.mem_total / 1e9).toFixed(1)} GB`;
      const diskPct = s.disk_total ? 100 * s.disk_free / s.disk_total : 0;
      setBar('bar-disk', diskPct);
      document.getElementById('m-disk').textContent = fmtBytes(s.disk_free) + ' free';

      const tRow = document.getElementById('temp-row'), tBar = document.getElementById('temp-bar');
      if (s.has_temp) {
        tRow.hidden = false; tBar.hidden = false;
        setBar('bar-temp', s.temp_c);
        document.getElementById('m-temp').textContent = s.temp_c.toFixed(0) + ' C';
      }

      document.getElementById('m-nd').textContent = (s.net_down_mbps || 0).toFixed(1) + ' Mbps';
      document.getElementById('m-nu').textContent = (s.net_up_mbps || 0).toFixed(1) + ' Mbps';
      const act = (s.ifaces || []).filter(i => i.active);
      const ni = act[0];
      document.getElementById('m-nif').textContent = ni ? ni.name : 'offline';
      document.getElementById('m-nip').textContent = ni ? (ni.ip || '—') : '—';
      document.getElementById('m-host').textContent = s.hostname || '—';

      // menu bar icons
      const batBtn = document.getElementById('tb-battery');
      if (s.battery && s.battery.has) {
        batBtn.hidden = false;
        document.getElementById('bat-pct').textContent = s.battery.pct + '%';
        document.getElementById('bat-icon').innerHTML =
          s.battery.charging ? Icons.get('charging', { size: 17 })
                             : Icons.get('batteryFull', { size: 17, pct: s.battery.pct });
      } else batBtn.hidden = true;

      const netIcon = document.getElementById('net-icon');
      if (ni) {
        netIcon.innerHTML = ni.type === 'wifi' ? Icons.get('wifi', { size: 16 })
                                              : Icons.get('ethernet', { size: 16 });
      } else {
        netIcon.innerHTML = Icons.get('wifiOff', { size: 16, color: '#7a7f8a' });
      }
      // mini grid
      document.getElementById('hc-healthy').textContent = lastSummary.healthy;
      document.getElementById('hc-configured').textContent = lastSummary.configured;
      document.getElementById('hc-unhealthy').textContent = lastSummary.unhealthy;

      const badge = document.getElementById('notif-badge');
      if (lastSummary.unhealthy > 0) { badge.hidden = false; badge.textContent = lastSummary.unhealthy; }
      else badge.hidden = true;

      if (typeof Grid !== 'undefined') Grid.updateHealth(lastHealth);
      if (typeof refreshDockDots === 'function') refreshDockDots();
    } catch (e) { /* keep last UI */ }
  }

  function setBar(id, pct) {
    pct = Math.max(0, Math.min(100, pct || 0));
    const b = document.getElementById(id);
    if (!b) return;
    b.style.width = pct + '%';
    b.classList.toggle('warn', pct >= 60 && pct < 85);
    b.classList.toggle('hot', pct >= 85);
  }

  function wxIcon(code) { return Icons.wxIcon(code, { size: 14 }); }

  // ---------- weather ----------
  async function initWeather() {
    try {
      const w = await API.get('/api/weather');
      if (w && w.ok) {
        lastWeather = w;
        document.getElementById('wx-chip').textContent = Math.round(w.current.temp) + '°';
        document.getElementById('wx-icon').innerHTML = Icons.wxIcon(w.current.code, { size: 16 });
        document.getElementById('wx-big').textContent = Math.round(w.current.temp) + '°';
        document.getElementById('wx-city').textContent = w.city;
      }
    } catch { /* offline ok */ }
  }
  // weather code -> macOS-style line icon
  function wxIcon(code) { return Icons.wxIcon(code, { size: 14 }); }

  function data() { return { snap: lastSnap, health: lastHealth, summary: lastSummary, weather: lastWeather }; }

  // ---------- static icon hydration (data-ic="name") ----------
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-ic]').forEach(el => {
      const n = el.dataset.ic;
      const size = el.closest('.dock-item') ? 30 : 15;
      const color = el.closest('.dock-item') ? 'var(--dico, #d8dae0)' : 'currentColor';
      el.innerHTML = Icons.get(n, { size, color, sw: 1.6 });
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
    });
  }

  return { refresh, initWeather, data, tickClock, wxIcon, hydrateIcons };
})();

// ============ menu-bar slide-down panel ============
const MBPanel = (() => {
  const panel = document.getElementById('mb-panel');
  let panelKey = null;
  let activeBtn = null;

  function close() {
    panel.hidden = true; panel.innerHTML = ''; panelKey = null;
    document.querySelectorAll('.mb-item.on').forEach(b => b.classList.remove('on'));
  }

  function bind(btnId, key, builder) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = e => {
      e.stopPropagation();
      if (panelKey === key) { close(); return; }
      try { Calendar.hide(); } catch {}   // only one popup at a time
      panel.innerHTML = builder();
      panel.hidden = false;
      panelKey = key;
      activeBtn = btn;
      anchor(panel, btn);           // slide down directly under the icon
      btn.classList.add('on');
    };
  }

  // Position a popup under the clicked menu-bar item, clamped to the viewport.
  function anchor(pop, btn) {
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth || 320;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - w - 10));
    pop.style.left = left + 'px';
    pop.style.right = 'auto';
    pop.style.top = Math.round(r.bottom + 8) + 'px';
    pop.style.setProperty('--ox', Math.round(r.left + r.width / 2 - left) + 'px');
  }

  function wpRow(k, v) { return `<div class="wp-row"><span class="k">${k}</span><span class="v">${v}</span></div>`; }
  function wpTitle(t, right) { return `<div class="wp-title"><b>${t}</b><span>${right || ''}</span></div>`; }

  function batteryPanel() {
    const s = Widgets.data().snap;
    const b = s && s.system.battery;
    if (!b || !b.has) return wpTitle('Battery', 'n/a') + wpRow('Status', 'Mains power') + wpRow('Detected', 'no battery');
    return wpTitle('Battery', b.pct + '%') +
      wpRow(Icons.get(b.charging ? 'bolt' : 'battery', { size: 13 }) + ' Status', b.charging ? 'Charging' : 'On battery') +
      wpRow('Plugged', b.plugged) +
      wpRow('Health', b.health) +
      wpRow('Temperature', b.temp ? b.temp.toFixed(1) + ' C' : 'n/a') +
      wpRow('Voltage', b.voltage ? b.voltage.toFixed(2) + ' V' : 'n/a');
  }

  function netPanel() {
    const s = Widgets.data().snap;
    if (!s) return '';
    const sys = s.system;
    const act = (sys.ifaces || []).filter(i => i.active);
    let rows = wpTitle('Network', act.length ? 'connected' : 'offline');
    rows += wpRow('Type', act[0] ? act[0].type : '—');
    rows += wpRow('Interface', act[0] ? act[0].name : '—');
    rows += wpRow('IP', act[0] && act[0].ip ? act[0].ip : '—');
    rows += wpRow('Download', (sys.net_down_mbps || 0).toFixed(1) + ' Mbps');
    rows += wpRow('Upload', (sys.net_up_mbps || 0).toFixed(1) + ' Mbps');
    return rows;
  }

  function wxPanel() {
    const w = Widgets.data().weather;
    const I = Widgets.wxIcon;
    if (!w || !w.ok) return wpTitle('Weather', 'n/a') + wpRow('Status', 'Unavailable');
    let rows = wpTitle('Weather · ' + w.city, Math.round(w.current.temp) + '°C');
    rows += wpRow(I(w.current.code) + ' Condition', 'feels ' + Math.round(w.current.apparent) + '°');
    rows += wpRow('Humidity', w.current.humidity + '%');
    rows += wpRow('Wind', Math.round(w.current.wind_kph) + ' km/h');
    (w.forecast || []).slice(0, 4).forEach(d => {
      rows += wpRow(new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + I(d.code),
        Math.round(d.tmax) + '° / ' + Math.round(d.tmin) + '°');
    });
    return rows;
  }

  function notifPanel() {
    const { health, summary } = Widgets.data();
    const list = Object.values(health).sort((a, b) => (a.healthy ? 1 : 0) - (b.healthy ? 1 : 0));
    let rows = wpTitle('Notifications', summary.healthy + ' up · ' + summary.unhealthy + ' down');
    rows += list.map(h => wpRow((h.healthy ? Icons.get('dotUp', { size: 12 }) + ' ' : Icons.get('dotDown', { size: 12 }) + ' ') + h.title, h.healthy ? h.latency_ms + ' ms' : 'down')).join('');
    if (!list.length) rows += wpRow('Health checks', 'none configured');
    return rows;
  }

  document.addEventListener('click', close);
  panel.addEventListener('click', e => e.stopPropagation());
  window.addEventListener('resize', () => { if (!panel.hidden && activeBtn) anchor(panel, activeBtn); });

  function bindAll() {
    bind('tb-battery', 'battery', batteryPanel);
    bind('tb-net', 'net', netPanel);
    bind('tb-wx', 'wx', wxPanel);
    bind('tb-notif', 'notif', notifPanel);
  }

  return { bind: bindAll, close, anchor };
})();

// ============ dock running dots ============
function refreshDockDots() {
  document.querySelectorAll('.dock-item').forEach(b => {
    const key = b.dataset.dock;
    let openWin = false;
    if (key === 'files') openWin = WinMgr.has('files');
    else if (key === 'notes') openWin = WinMgr.has('notes');
    else if (key === 'settings') openWin = WinMgr.has('settings');
    else if (key === 'monitor') openWin = WinMgr.has('monitor');
    b.classList.toggle('running', openWin);
  });
}

// ============ calendar popup (Notification Center style) ============
const Calendar = (() => {
  const pop = document.getElementById('cal-pop');
  let view = new Date();
  let selDay = null;

  function toggle() { pop.hidden ? show() : hide(); }
  function hide() { pop.hidden = true; document.getElementById('tb-clock').classList.remove('on'); }
  function show() {
    view = new Date(); selDay = null;
    draw();
    pop.hidden = false;
    MBPanel.close();
    MBPanel.anchor(pop, document.getElementById('tb-clock'));
    document.getElementById('tb-clock').classList.add('on');
  }
  window.addEventListener('resize', () => {
    if (!pop.hidden) MBPanel.anchor(pop, document.getElementById('tb-clock'));
  });

  function draw() {
    const now = new Date();
    if (!selDay) selDay = now.getDate();
    const y = view.getFullYear(), m = view.getMonth();
    const first = new Date(y, m, 1);
    const startWd = first.getDay(); // 0=Sun
    const dim = new Date(y, m + 1, 0).getDate();
    const prevDim = new Date(y, m, 0).getDate();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const selDate = new Date(y, m, Math.min(selDay || 1, dim));

    let cells = '';
    ['SU','MO','TU','WE','TH','FR','SA'].forEach(d => cells += `<span class="wd">${d}</span>`);
    for (let i = 0; i < startWd; i++) cells += `<span class="dy out" data-go="-1">${prevDim - startWd + 1 + i}</span>`;
    for (let d = 1; d <= dim; d++) {
      const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
      const isSel = d === selDay;
      cells += `<span class="dy${isToday && !isSel ? ' today' : ''}${isSel ? ' sel' : ''}" data-d="${d}">${d}</span>`;
    }
    const tail = (7 - ((startWd + dim) % 7)) % 7;
    for (let i = 1; i <= tail; i++) cells += `<span class="dy out" data-go="1">${i}</span>`;

    pop.innerHTML = `
      <div class="cal-top"><span class="cal-kicker">CALENDAR</span><span class="cal-year">${y}</span></div>
      <div class="cal-today">${selDate.toLocaleDateString(undefined, { weekday: 'long' })}<span class="cal-daynum">${selDate.getDate()}</span></div>
      <div class="cal-nav">
        <button id="cal-prev" title="Previous month">${Icons.get('chevronLeft', { size: 14 })}</button>
        <b>${months[m]}</b>
        <button id="cal-next" title="Next month">${Icons.get('chevronRight', { size: 14 })}</button>
      </div>
      <div class="cal-grid">${cells}</div>`;

    pop.querySelector('#cal-prev').onclick = e => { e.stopPropagation(); view = new Date(y, m - 1, 1); selDay = null; draw(); };
    pop.querySelector('#cal-next').onclick = e => { e.stopPropagation(); view = new Date(y, m + 1, 1); selDay = null; draw(); };
    pop.querySelectorAll('.dy[data-d]').forEach(c => c.onclick = e => { e.stopPropagation(); selDay = +c.dataset.d; draw(); });
    // clicking a faded adjacent-month day jumps to that month, day preselected
    pop.querySelectorAll('.dy[data-go]').forEach(c => c.onclick = e => {
      e.stopPropagation();
      const go = +c.dataset.go;
      view = new Date(y, m + go, 1);
      selDay = +c.textContent;
      draw();
    });
  }

  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target.closest('#tb-clock') === null) hide(); });
  return { toggle, hide, isOpen: () => !pop.hidden };
})();

// ============ launchpad (hides all windows like Win+D) ============
const Launchpad = (() => {
  const lp = document.getElementById('launchpad');
  const grid = document.getElementById('lp-grid');
  function open() {
    WinMgr.minimizeAll();          // show home behind, like clicking the desktop
    grid.innerHTML = '';
    for (const a of Grid.all()) grid.append(Grid.tileFor(a));
    lp.hidden = false;
  }
  function close() { lp.hidden = true; WinMgr.restoreAll(); }
  lp.addEventListener('click', e => { if (e.target === lp) close(); });
  return { open, close, isOpen: () => !lp.hidden };
})();

// ============ spotlight (⌘K search) ============
const Spotlight = (() => {
  const wrap = el('div', 'mp-search-wrap');
  wrap.innerHTML = `<input id="mp-search" placeholder="Search apps, actions…" autocomplete="off"><div class="mp-res" id="mp-res" hidden></div>`;
  document.body.append(wrap);
  wrap.style.display = 'none';
  const input = wrap.querySelector('#mp-search');
  const res = wrap.querySelector('#mp-res');
  let sel = 0, items = [];

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function open() { wrap.style.display = ''; input.value = ''; build(); input.focus(); }
  function close() { wrap.style.display = 'none'; }
  function isOpen() { return wrap.style.display !== 'none'; }

  input.addEventListener('input', build);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
    else if (e.key === 'Enter') { run(); }
    else if (e.key === 'Escape') close();
  });

  function build() {
    const acts = [
      { t: 'Files', c: 'Module', ic: Icons.get('folder', { size: 15 }), fn: () => FilesModule.open() },
      { t: 'Activity', c: 'Module', ic: Icons.get('activity', { size: 15 }), fn: () => openActivity() },
      { t: 'System Settings', c: 'Module', ic: Icons.get('gear', { size: 15 }), fn: () => Settings.open() },
      { t: 'Notes', c: 'Module', ic: Icons.get('note', { size: 15 }), fn: () => openNotes() },
      { t: 'Launchpad', c: 'Module', ic: Icons.get('apps', { size: 15 }), fn: () => Launchpad.open() },
      { t: 'About This Hemio', c: 'Info', ic: Icons.get('hexagon', { size: 15 }), fn: () => openAbout() },
    ];
    const q = input.value.trim().toLowerCase();
    items = acts.filter(a => !q || a.t.toLowerCase().includes(q));
    for (const a of Grid.all()) {
      if (!q || a.title.toLowerCase().includes(q))
        items.push({ t: a.title, c: a.category || 'App', ic: Icons.get('globe', { size: 15 }), fn: () => window.open(a.url, '_blank', 'noopener') });
    }
    items = items.slice(0, 14);
    sel = 0;
    res.hidden = !items.length;
    res.innerHTML = '';
    items.forEach((it, i) => {
      const b = el('button', i === 0 ? 'sel' : '');
      b.innerHTML = `<span class="ic">${it.ic}</span>${esc(it.t)}<span class="cat">${esc(it.c)}</span>`;
      b.onclick = () => { it.fn(); close(); };
      res.append(b);
    });
  }
  function paint() { [...res.children].forEach((c, i) => c.classList.toggle('sel', i === sel)); }
  function run() { if (items[sel]) { const f = items[sel].fn; close(); f(); } }

  return { open, close, isOpen };
})();

// ============ extra windows ============
function openActivity() {
  const w = WinMgr.create('monitor', 'Activity', { width: 680, height: 560, icon: Icons.get('activity', { size: 14 }) });
  const body = w.querySelector('.win-body');
  body.style.padding = '14px';
  if (!body.dataset.built) {
    body.dataset.built = '1';
    body.innerHTML = `
      <div class="am-wrap">
        <div class="am-tabs">
          <button class="sel" data-tab="overview">Overview</button>
          <button data-tab="memory">Memory</button>
          <button data-tab="disk">Disk</button>
          <button data-tab="network">Network</button>
        </div>
        <div class="am-stats" id="am-stats"></div>
        <div class="am-grid" id="am-grid">
          <div class="am-card"><h4>${Icons.get('monitor', { size: 14 })} CPU History</h4><div class="am-chart" id="am-cpu"></div>
            <div class="am-row"><span class="k">Current</span><span class="v" id="am-cur">—</span></div>
            <div class="am-row"><span class="k">Peak</span><span class="v" id="am-peak">—</span></div></div>
          <div class="am-card"><h4>${Icons.get('memory', { size: 14 })} Memory Pressure</h4><div class="am-chart" id="am-mem"></div>
            <div class="am-row"><span class="k">Used %</span><span class="v" id="am-mpct">—</span></div>
            <div class="am-row"><span class="k">Used</span><span class="v" id="am-mused">—</span></div></div>
          <div class="am-card"><h4>${Icons.get('disk', { size: 14 })} Disk Usage</h4><div class="am-disk-bar"><i id="am-dbar"></i></div>
            <div class="am-row"><span class="k">Used</span><span class="v" id="am-dused">—</span></div>
            <div class="am-row"><span class="k">Total</span><span class="v" id="am-dtot">—</span></div>
            <div class="am-row"><span class="k">Usage</span><span class="v" id="am-dpct">—</span></div></div>
          <div class="am-card"><h4>${Icons.get('cpu', { size: 14 })} Load Average</h4><div class="am-load" style="margin-top:6px">
              <div class="sub"><b id="am-l1">—</b><span>1m</span></div>
              <div class="sub"><b id="am-l5">—</b><span>5m</span></div>
              <div class="sub"><b id="am-l15">—</b><span>15m</span></div>
            </div>
            <div class="am-row"><span class="k">Interface</span><span class="v" id="am-nif">—</span></div></div>
        </div>
        <div class="am-card"><h4>${Icons.get('network', { size: 14 })} Network <span style="margin-left:auto;font-size:10px;color:var(--grn);letter-spacing:1px">● LIVE</span></h4>
          <div class="am-row"><span class="k">Total received</span><span class="v" id="am-rx">—</span></div>
          <div class="am-row"><span class="k">Total sent</span><span class="v" id="am-tx">—</span></div>
        </div>
      </div>`;
    const tabs = body.querySelectorAll('.am-tabs button');
    const gridEl = body.querySelector('#am-grid');
    tabs.forEach(b => b.onclick = () => {
      tabs.forEach(x => x.classList.toggle('sel', x === b));
      const t = b.dataset.tab;
      gridEl.querySelectorAll('.am-card').forEach(c => c.style.display = '');
      if (t === 'overview') return;
      const want = { memory: 1, disk: 2, network: 3 }[t];
      gridEl.querySelectorAll('.am-card').forEach((c, i) => c.style.display = (i === want || (t === 'network' && i === 1) ? '' : 'none'));
    });
  }

  const hist = [], memHist = [];
  function svgLine(box, series, color, max) {
    if (!box.clientWidth || !series.length) return;
    const W = box.clientWidth, H = box.clientHeight, n = Math.max(2, series.length);
    let pts = '';
    series.forEach((v, i) => { pts += `${((i / (n - 1)) * W).toFixed(1)},${(H - (Math.min(v, max) / max) * (H - 12) - 6).toFixed(1)} `; });
    box.innerHTML = `<svg width="100%" height="${H}" style="display:block">
      <g stroke="rgba(255,255,255,.05)"><line x1="0" y1="${H*.5}" x2="${W}" y2="${H*.5}"/></g>
      <polygon points="0,${H} ${pts} ${W},${H}" fill="${color}22"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
    </svg>`;
  }

  function draw() {
    const s = Widgets.data().snap;
    if (!s) return;
    const sys = s.system;
    const { summary } = Widgets.data();
    const ramPct = sys.mem_total ? 100 * sys.mem_used / sys.mem_total : 0;
    hist.push(sys.cpu_pct || 0); if (hist.length > 90) hist.shift();
    memHist.push(ramPct); if (memHist.length > 90) memHist.shift();

    body.querySelector('#am-stats').innerHTML = `
      <div class="am-stat"><span class="ic">${Icons.get('cpu', { size: 16 })}</span><div class="l">CPU</div><div class="v">${(sys.cpu_pct||0).toFixed(1)}%</div><div class="s">System average</div></div>
      <div class="am-stat"><span class="ic">${Icons.get('memory', { size: 16 })}</span><div class="l">MEMORY</div><div class="v">${ramPct.toFixed(1)}%</div><div class="s">${(sys.mem_used/1e9).toFixed(1)} / ${(sys.mem_total/1e9).toFixed(1)} GB</div></div>
      <div class="am-stat"><span class="ic">${Icons.get('box', { size: 16 })}</span><div class="l">APPS</div><div class="v">${summary.healthy}</div><div class="s">${summary.configured + summary.healthy + summary.unhealthy} configured</div></div>
      <div class="am-stat"><span class="ic">${Icons.get('download', { size: 16 })}</span><div class="l">NET RX</div><div class="v">${(sys.net_rx_mb/1000||0).toFixed(1)}</div><div class="s">GB received</div></div>
      <div class="am-stat"><span class="ic">${Icons.get('upload', { size: 16 })}</span><div class="l">NET TX</div><div class="v">${(sys.net_tx_mb/1000||0).toFixed(1)}</div><div class="s">GB sent</div></div>`;

    svgLine(body.querySelector('#am-cpu'), hist, '#e8821e', 100);
    svgLine(body.querySelector('#am-mem'), memHist, '#2ecc71', 100);
    body.querySelector('#am-cur').textContent = (hist[hist.length-1]||0).toFixed(1) + '%';
    body.querySelector('#am-peak').textContent = Math.max(...hist).toFixed(1) + '%';
    body.querySelector('#am-mpct').textContent = ramPct.toFixed(1) + '%';
    body.querySelector('#am-mused').textContent = (sys.mem_used/1e9).toFixed(1) + ' GB';
    const used = sys.disk_total - sys.disk_free;
    body.querySelector('#am-dbar').style.width = (100*used/sys.disk_total) + '%';
    body.querySelector('#am-dused').textContent = (used/1e9).toFixed(2) + ' GB';
    body.querySelector('#am-dtot').textContent = (sys.disk_total/1e9).toFixed(2) + ' GB';
    body.querySelector('#am-dpct').textContent = (100*used/sys.disk_total).toFixed(1) + '%';
    body.querySelector('#am-l1').textContent = sys.load1 ? sys.load1.toFixed(2) : '—';
    body.querySelector('#am-l5').textContent = sys.load5 ? sys.load5.toFixed(2) : '—';
    body.querySelector('#am-l15').textContent = sys.load15 ? sys.load15.toFixed(2) : '—';
    const act = (sys.ifaces || []).filter(i => i.active)[0];
    body.querySelector('#am-nif').textContent = act ? act.name : '—';
    body.querySelector('#am-rx').textContent = (sys.net_rx_mb||0).toFixed(0) + ' MB';
    body.querySelector('#am-tx').textContent = (sys.net_tx_mb||0).toFixed(0) + ' MB';
  }
  draw();
  const t = setInterval(() => { if (w.isConnected) draw(); else clearInterval(t); }, 1500);
}

function openAbout() {
  const s = Widgets.data().snap;
  const sys = s ? s.system : {};
  const w = WinMgr.create('about', 'About This Hemio', { width: 340, height: 0, fit: true, icon: Icons.get('hexagon', { size: 14 }) });
  w.querySelector('.win-body').innerHTML = `
    <div style="text-align:center;padding:18px 6px 10px">
      <div class="about-hex">${Icons.get('hexagon', { size: 52 })}</div>
      <div style="font-weight:800;font-size:17px;margin-top:6px">Hemio Dashboard</div>
      <div style="color:var(--dim);font-size:12px;margin:2px 0 16px">macOS Edition · v1.2</div>
    </div>
    ${[['Platform', (sys.os||'—')+' / '+(sys.arch||'—')], ['Hostname', sys.hostname||'—'],
       ['CPU', sys.cpu_model||sys.arch||'—'], ['Uptime', fmtUptime(sys.uptime_sec||0)]]
      .map(r => `<div class="pv"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}`;
  WinMgr.fit(w);
}
