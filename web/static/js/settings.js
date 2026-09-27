// settings.js — macOS "System Settings" two-pane (General / Appearance / Users & Access)
const Settings = (() => {
  const KEY = '***';

  const defaults = {
    tint: 0.42,
    blur: 28,
    accent: '#e8821e',
    wallpaper: 'sequoia',
    name: 'Hemio',
    theme: 'dark',       // dark | light (visual toggle only)
    shape: 12,           // corner radius px
    radiusMode: 'default', // sharp | default | soft
    glass: 'clear',      // clear | tinted
    iconSize: 'medium',  // small | medium | large
    font: 'default',     // compact | default | large | xl
  };

  const ACCENTS = {
    Multicolor: 'conic-gradient(#ff5f57,#febc2e,#28c840,#3aa0ff,#bf5af2,#ff5f57)',
    Orange: '#f97316', Teal: '#14b8a6', Blue: '#3b82f6',
    Green: '#22c55e', Yellow: '#eab308', Pink: '#ef4444', Purple: '#8b5cf6',
  };

  const presets = {
    sequoia:  'radial-gradient(1300px 800px at 78% -12%, #b4482a 0%, transparent 52%), radial-gradient(1000px 720px at 112% 30%, #6e2a55 0%, transparent 55%), radial-gradient(900px 680px at -8% 96%, #1d2a4e 0%, transparent 55%), linear-gradient(165deg, #2b1420 0%, #351d24 34%, #1c1020 68%, #0b0810 100%)',
    graphite: 'radial-gradient(1100px 700px at 70% -10%, #3a4048 0%, transparent 55%), radial-gradient(900px 700px at 0% 100%, #23272e 0%, transparent 60%), linear-gradient(160deg, #14161a 0%, #1d2026 50%, #101215 100%)',
    midnight: 'radial-gradient(1000px 700px at 20% 20%, #251b4e 0%, transparent 55%), radial-gradient(900px 900px at 85% 90%, #101c3f 0%, transparent 60%), #05070d',
    aurora:   'radial-gradient(1100px 700px at 80% 0%, #0f5c4a 0%, transparent 55%), radial-gradient(900px 800px at 10% 90%, #1a2f6e 0%, transparent 55%), linear-gradient(150deg, #05100e 0%, #0a1a2a 60%, #050a12 100%)',
    sol:      'radial-gradient(1200px 760px at 50% -20%, #d97a2b 0%, transparent 55%), radial-gradient(1000px 700px at 100% 80%, #7a2b55 0%, transparent 60%), linear-gradient(170deg, #2a1207 0%, #3a1c10 40%, #14080c 100%)',
  };

  let state = load();
  let authStatus = { enabled: false, username: 'admin', session_minutes: 15, version: '—' };

  function load() {
    const s = { ...defaults };
    try { Object.assign(s, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
    return s;
  }

  function save(serverSync = true) {
    localStorage.setItem(KEY, JSON.stringify(state));
    apply();
    if (serverSync) API.post('/api/settings', state).catch(() => {});
  }

  function apply() {
    const r = document.documentElement.style;
    r.setProperty('--amber', state.accent);
    r.setProperty('--accent', state.accent);
    r.setProperty('--amber-soft', hexA(state.accent, .22));
    r.setProperty('--blur', state.blur + 'px');
    r.setProperty('--tint', state.glass === 'tinted' ? hexA('#121014', Math.max(.62, state.tint)) : hexA('#121014', state.tint));
    r.setProperty('--radius', state.shape + 'px');
    const fs = { compact: 13.5, default: 15, large: 16.5, xl: 18 }[state.font] || 15;
    r.setProperty('font-size', fs + 'px');
    const tile = { small: 52, medium: 62, large: 74 }[state.iconSize] || 62;
    document.querySelectorAll('#app-row .app-tile .sq').forEach(x => { x.style.width = tile + 'px'; x.style.height = tile + 'px'; });
    document.getElementById('mb-welcome').textContent = 'Welcome back, ' + (state.name || 'Hemio');

    const wp = document.getElementById('wallpaper');
    if (!wp) return;
    if (String(state.wallpaper).startsWith('url:')) {
      wp.style.setProperty('--wp', `#0b0e14 url("${state.wallpaper.slice(4)}") center/cover no-repeat`);
    } else {
      wp.style.setProperty('--wp', presets[state.wallpaper] || presets.sequoia);
    }
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ================= window =================
  let page = 'general';
  function open() {
    API.get('/api/auth/status').then(st => { authStatus = st; paint(); }).catch(() => paint());
    const w = WinMgr.create('settings', 'Settings', { width: 640, height: 520, icon: Icons.get('gear', { size: 14 }) });
    const body = w.querySelector('.win-body');
    body.style.padding = '12px';
    body.innerHTML = '<div class="st-split"><aside class="st-side" id="st-side"></aside><div class="st-main" id="st-main"></div></div>';
    paint();
    return w;
  }

  function paint() {
    const w = WinMgr.get('settings');
    if (!w) return;
    const side = w.querySelector('#st-side'), main = w.querySelector('#st-main');
    if (!side || !main) return;
    side.innerHTML = `
      <div class="st-sect" style="display:block;margin:2px 0 6px">SYSTEM</div>
      <button class="st-link ${page==='general'?'sel':''}" data-p="general"><span class="li">${Icons.get('monitor', { size: 14 })}</span>General</button>
      <button class="st-link ${page==='appearance'?'sel':''}" data-p="appearance"><span class="li">${Icons.get('paint', { size: 14 })}</span>Appearance</button>
      <div class="st-sect" style="display:block;margin:10px 0 6px">ACCESS</div>
      <button class="st-link ${page==='access'?'sel':''}" data-p="access"><span class="li">${Icons.get('user', { size: 14 })}</span>Users &amp; Access</button>
      <div class="st-side-foot">
        <span class="on">● ${esc(authStatus.username || 'admin')}</span><br>
        ${authStatus.version} · ${(Widgets.data().snap?.system?.os || '')} ${(Widgets.data().snap?.system?.arch || '')}
      </div>`;
    side.querySelectorAll('.st-link').forEach(b => b.onclick = () => { page = b.dataset.p; paint(); });
    main.innerHTML = ({ general: pageGeneral, appearance: pageAppearance, access: pageAccess }[page] || pageGeneral)();
    wire(w);
  }

  function pageGeneral() {
    const snap = Widgets.data().snap || {}; const sys = snap.system || {};
    const ramPct = sys.mem_total ? 100 * sys.mem_used / sys.mem_total : 0;
    return `
      <div class="st-page-head"><h2>General</h2><button class="st-save" id="st-save">Save Changes</button></div>
      <div class="st-sect">SYSTEM INFO</div>
      <div class="st-card">
        ${row('Hostname', esc(sys.hostname || '—'))}
        ${row('OS', esc((sys.os || '—') + ' / ' + (sys.arch || '—')))}
        ${row('Kernel', esc(sys.kernel || '—'))}
        ${row('Architecture', esc(sys.arch || '—'))}
        ${row('CPU', esc(sys.cpu_model || '—'))}
        ${row('Uptime', esc(fmtUptime(sys.uptime_sec || 0)))}
        ${row('Hemio Version', esc(authStatus.version || '1.2.0'))}
      </div>
      <div class="st-sect">HARDWARE</div>
      <div class="st-card">
        ${hw(Icons.get('chip', { size: 18 }), '#1e3a5f', 'PROCESSOR', ((sys.cpu_pct || 0).toFixed(0)) + '% load')}
        ${hw(Icons.get('memory', { size: 18 }), '#12351f', 'MEMORY', `${(sys.mem_used/1e9).toFixed(1)} GB / ${(sys.mem_total/1e9).toFixed(1)} GB (${ramPct.toFixed(0)}%)`)}
        ${sys.has_temp ? hw(Icons.get('thermo', { size: 18 }), '#4a2c14', 'CPU TEMPERATURE', sys.temp_c.toFixed(1) + ' C') : hw(Icons.get('thermo', { size: 18 }), '#4a2c14', 'CPU TEMPERATURE', 'n/a (no sensor)')}
        ${hw(Icons.get('network', { size: 18 }), '#173a4a', 'NET ↓ / ↑', `${(sys.net_down_mbps||0).toFixed(1)} / ${(sys.net_up_mbps||0).toFixed(1)} Mbps`)}
        ${hw(Icons.get('user', { size: 18 }), '#3f2f14', 'USER', authStatus.enabled ? authStatus.username : 'guest (auth disabled)')}
      </div>`;
  }
  function row(k, v) { return `<div class="st-row"><span class="lbl">${k}</span><span class="val">${v}</span></div>`; }
  function rowEsc(k, v) { return row(k, esc(v)); }
  function hw(ic, bg, l, v) { return `<div class="st-row"><div class="st-hw"><span class="tile" style="background:${bg}">${ic}</span><div><div class="t-l">${l}</div><div class="t-v">${esc(v)}</div></div></div></div>`; }

  function pageAppearance() {
    return `
      <div class="st-page-head"><h2>Appearance</h2><button class="st-save" id="st-save">Save Changes</button></div>
      <div class="st-sect">THEME</div>
      <div style="display:flex;gap:12px" id="theme-cards">
        ${themeCard('dark', 'Dark')} ${themeCard('light', 'Light')}
      </div>
      <div class="st-sect">ACCENT COLOR</div>
      <div class="st-card" style="padding:14px">
        <div class="accent-dots" id="accent-dots">
          ${Object.entries(ACCENTS).map(([n, c]) =>
            `<button data-name="${n}" data-color="${c}" title="${n}" style="background:${c}" class="${n === accName() ? 'sel' : ''}"></button>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--dim);margin-top:8px">${accName()}</div>
      </div>
      <div class="st-sect">WALLPAPER</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="wp-chips"></div>
      <div class="st-sect">SHAPE</div>
      <div class="st-card" style="padding:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:26px;height:26px;border-radius:${state.shape}px;background:var(--amber-soft);border:1px solid var(--amber);flex:none"></span>
          <input type="range" id="s-shape" min="0" max="22" step="1" value="${state.shape}" style="flex:1;accent-color:var(--amber)">
          <span class="val" style="color:var(--amber);font-size:12px">${state.shape}px</span>
        </div>
        <div class="seg" id="seg-shape" style="margin-top:12px;width:100%">
          <button data-v="sharp" class="${state.radiusMode==='sharp'?'sel':''}" style="flex:1">Sharp</button>
          <button data-v="default" class="${state.radiusMode==='default'?'sel':''}" style="flex:1">Default</button>
          <button data-v="soft" class="${state.radiusMode==='soft'?'sel':''}" style="flex:1">Soft</button>
        </div>
      </div>
      <div class="st-sect">LIQUID GLASS</div>
      <div style="font-size:11.5px;color:var(--dim);margin:-4px 0 8px">Choose the look of glass surfaces across the interface.</div>
      <div style="display:flex;gap:12px" id="glass-cards">
        ${glassCard('clear', 'Clear')} ${glassCard('tinted', 'Tinted')}
      </div>
      <div class="st-sect">DISPLAY</div>
      <div class="st-card">
        <div class="st-row"><span class="lbl">Icon size</span>
          <span class="seg" id="seg-icon">
            ${['small','medium','large'].map(v => `<button data-v="${v}" class="${state.iconSize===v?'sel':''}">${cap(v)}</button>`).join('')}
          </span></div>
        <div class="st-row"><span class="lbl">Font size</span>
          <span class="seg" id="seg-font">
            ${['compact','default','large','xl'].map(v => `<button data-v="${v}" class="${state.font===v?'sel':''}">${cap(v)}</button>`).join('')}
          </span></div>
        <div class="st-row"><span class="lbl">Blur intensity</span>
          <span style="display:flex;align-items:center;gap:8px"><input type="range" id="s-blur" min="0" max="60" step="1" value="${state.blur}" style="accent-color:var(--amber);width:120px"><span class="val">${state.blur}px</span></span></div>
        <div class="st-row"><span class="lbl">Glass transparency</span>
          <span style="display:flex;align-items:center;gap:8px"><input type="range" id="s-tint" min="0.15" max="0.9" step="0.05" value="${state.tint}" style="accent-color:var(--amber);width:120px"><span class="val">${Math.round((1 - state.tint) * 100)}%</span></span></div>
      </div>`;
  }

  function themeCard(k, label) {
    const on = state.theme === k;
    const bg = k === 'dark' ? 'linear-gradient(160deg,#1c1a20,#0c0b0e)' : 'linear-gradient(160deg,#f4f4f6,#dcdce0)';
    return `<div class="st-card" data-theme="${k}" style="flex:0 0 150px;padding:10px;cursor:pointer;border:2px solid ${on ? 'var(--amber)' : 'rgba(255,255,255,.08)'};position:relative">
      <div style="height:56px;border-radius:8px;background:${bg};position:relative;overflow:hidden">
        <span style="position:absolute;left:8px;top:8px;width:55%;height:5px;border-radius:3px;background:${k==='dark'?'rgba(255,255,255,.25)':'rgba(0,0,0,.18)'}"></span>
        <span style="position:absolute;left:8px;top:18px;width:38%;height:5px;border-radius:3px;background:${k==='dark'?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)'}"></span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span style="font-size:12px;font-weight:700;color:${on ? 'var(--amber)' : 'var(--dim)'}">${label}</span>
        ${on ? '<span style="width:16px;height:16px;border-radius:50%;background:var(--amber);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center">✓</span>' : ''}
      </div></div>`;
  }

  function glassCard(k, label) {
    const on = state.glass === k;
    const bg = k === 'clear'
      ? 'linear-gradient(160deg,rgba(232,130,30,.18),rgba(120,80,200,.14))'
      : 'linear-gradient(160deg,#15131a,#0d0c10)';
    return `<div class="st-card" data-glass="${k}" style="flex:0 0 150px;padding:10px;cursor:pointer;border:2px solid ${on ? 'var(--amber)' : 'rgba(255,255,255,.08)'}">
      <div style="height:56px;border-radius:8px;background:${bg};border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(${k==='clear'?18:2}px)"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span style="font-size:12px;font-weight:700;color:${on ? 'var(--amber)' : 'var(--dim)'}">${label}</span>
        ${on ? '<span style="width:16px;height:16px;border-radius:50%;background:var(--amber);color:#fff;font-size:10px;display:inline-flex;align-items:center;justify-content:center">✓</span>' : ''}
      </div></div>`;
  }

  function pageAccess() {
    const st = authStatus;
    return `
      <div class="st-page-head"><h2>Users & Access</h2><button class="st-save" id="st-save">Save Changes</button></div>
      <div class="st-sect">ACCOUNT</div>
      <div class="st-card">
        ${row('Status', (st.enabled ? Icons.get('lock', { size: 13, color: '#e9eef6' }) : Icons.get('power', { size: 13, color: '#e9eef6' })) + ' ' + (st.enabled ? 'Login required' : 'Auth disabled (HEMIO_NO_AUTH=***'))}
        ${row('Username', st.username)}
        ${row('Version', st.version)}
        ${st.default_password ? `<div class="st-row"><span class="lbl danger">${Icons.get('info', { size: 13, color: '#ff6b6b' })} Warning</span><span class="val danger" style="font-family:var(--sans)">Still using default password — change it below</span></div>` : ''}
      </div>
      <div class="st-sect">CHANGE PASSWORD</div>
      <div class="st-card" style="padding:14px;display:flex;flex-direction:column;gap:8px">
        <input class="st-input" id="pw-cur" type="password" placeholder="Current password" style="width:100%" autocomplete="current-password">
        <input class="st-input" id="pw-new" type="password" placeholder="New password (min 4 chars)" style="width:100%" autocomplete="new-password">
        <button class="st-save" id="pw-go" style="align-self:flex-start">Update password</button>
      </div>
      <div class="st-sect">SESSION</div>
      <div class="st-card" style="padding:14px;display:flex;align-items:center;gap:12px">
        <span style="font-size:12px;color:var(--dim)">Auto-logout after</span>
        <span class="seg" id="seg-sess">
          ${[10, 20, 30, 60].map(m => `<button data-v="${m}" class="${st.session_minutes == m ? 'sel' : ''}">${m} min</button>`).join('')}
        </span>
      </div>`;
  }

  // ---------- wire up the painted controls ----------
  function wire(w) {
    const main = w.querySelector('#st-main');
    const saveBtn = main.querySelector('#st-save');
    if (saveBtn) saveBtn.onclick = () => { save(); toast('Settings saved'); };

    main.querySelectorAll('[data-theme]').forEach(c => c.onclick = () => { state.theme = c.dataset.theme; save(false); paint(); });
    main.querySelectorAll('[data-glass]').forEach(c => c.onclick = () => { state.glass = c.dataset.glass; save(false); paint(); });

    const dots = main.querySelector('#accent-dots');
    if (dots) dots.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (b.dataset.name !== 'Multicolor') state.accent = b.dataset.color;
      save(); paint();
    });

    // wallpaper chips
    const chips = main.querySelector('#wp-chips');
    if (chips) {
      for (const [name, css] of Object.entries(presets)) {
        const c = el('div', 'wp-chip' + (state.wallpaper === name ? ' sel' : ''));
        c.style.background = css; c.title = name;
        c.onclick = () => { state.wallpaper = name; save(); paint(); };
        chips.append(c);
      }
      const custom = el('div', 'wp-chip');
      custom.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:16px;background:rgba(255,255,255,.08)';
      custom.innerHTML = Icons.get('globe', { size: 15 }); custom.title = 'Custom image URL';
      custom.onclick = () => {
        const u = prompt('Wallpaper image URL:', state.wallpaper.startsWith('url:') ? state.wallpaper.slice(4) : 'https://');
        if (u && u.startsWith('http')) { state.wallpaper = 'url:' + u; save(); paint(); }
      };
      chips.append(custom);
    }

    bind(main, '#s-shape', v => { state.shape = +v; apply(); }, () => { save(); paint(); });
    bind(main, '#s-blur', v => { state.blur = +v; apply(); }, () => { save(); paint(); });
    bind(main, '#s-tint', v => { state.tint = +v; apply(); }, () => { save(); paint(); });

    const seg = (id, key) => main.querySelectorAll(id + ' button').forEach(b => b.onclick = () => {
      state[key] = b.dataset.v; save(); paint();
    });
    seg('#seg-icon', 'iconSize');
    seg('#seg-font', 'font');

    // radius mode presets shape too
    main.querySelectorAll('#seg-shape button').forEach(b => b.onclick = () => {
      state.radiusMode = b.dataset.v;
      state.shape = b.dataset.v === 'sharp' ? 4 : b.dataset.v === 'soft' ? 18 : 12;
      save(); paint();
    });

    main.querySelectorAll('#seg-sess button').forEach(b => b.onclick = async () => {
      try {
        await API.post('/api/auth/session', { minutes: +b.dataset.v });
        authStatus.session_minutes = +b.dataset.v;
        toast('Session set to ' + b.dataset.v + ' minutes'); paint();
      } catch (e) { toast('Failed: ' + e.message); }
    });

    // radius mode presets shape too
    main.querySelectorAll('#seg-shape button').forEach(b => b.onclick = () => {
      state.radiusMode = b.dataset.v;
      state.shape = b.dataset.v === 'sharp' ? 4 : b.dataset.v === 'soft' ? 18 : 12;
      save(); paint();
    });

    const pwGo = main.querySelector('#pw-go');
    if (pwGo) pwGo.onclick = async () => {
      const cur = main.querySelector('#pw-cur').value;
      const nw = main.querySelector('#pw-new').value;
      try {
        await API.post('/api/auth/password', { current: cur, new: nw });
        toast('Password updated — session refreshed');
        authStatus.default_password = false;
        paint();
      } catch (e) {
        toast(e.message.includes('400') ? 'Wrong current password, or new one too short' : 'Failed: ' + e.message);
      }
    };
  }
  function bind(root, id, live, done) {
    const i = root.querySelector(id);
    if (!i) return;
    i.oninput = e => live(e.target.value);
    i.onchange = done;
  }

  function accName() {
    for (const [n, v] of Object.entries(ACCENTS)) if (v === state.accent) return n;
    return 'Custom';
  }
  function cap(s) { return s[0].toUpperCase() + s.slice(1); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- boot sync ----------
  async function syncFromServer() {
    const hasLocal = localStorage.getItem(KEY);
    try {
      const server = await API.get('/api/settings');
      if (server && typeof server === 'object' && Object.keys(server).length) {
        state = hasLocal ? { ...defaults, ...JSON.parse(hasLocal) } : { ...defaults, ...server };
        localStorage.setItem(KEY, JSON.stringify(state));
      }
    } catch {}
    apply();
  }

  return { open, syncFromServer, apply };
})();
