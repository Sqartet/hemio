// main.js — boot: wire dock, menu bar, shortcuts, polling loops
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', ''); t.id = 'toast'; document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2400);
}

function openNotes() {
  const w = WinMgr.create('notes', 'Notes', {
    width: 440, height: 0, fit: true,
    icon: Icons.get('note', { size: 14 })
  });
  const body = w.querySelector('.win-body');
  if (!body.dataset.built) {
    body.dataset.built = '1';
    body.innerHTML = '';
    body.style.padding = '12px';
    const ta = el('textarea', 'fx-notes');
    ta.value = localStorage.getItem('hemio_notes') || '';
    ta.placeholder = 'Start typing… (saved in this browser)';
    ta.oninput = () => localStorage.setItem('hemio_notes', ta.value);
    body.append(ta);
    WinMgr.fit(w);
  }
  return w;
}

async function hemioLogout() {
  if (!confirm('Sign out of Hemio?')) return;
  try { await API.post('/api/logout'); } catch {}
  location.href = '/login';
}

(async function boot() {
  Settings.apply();
  await Settings.syncFromServer();

  Grid.load();
  Widgets.initWeather();
  Widgets.tickClock();

  // polling: system every 3s, weather every 10min
  Widgets.hydrateIcons();
  document.getElementById('notif-icon').innerHTML = Icons.get('bell', { size: 15 });
  document.getElementById('power-icon').innerHTML = Icons.get('power', { size: 15 });
  const spot = document.getElementById('spotlight');
  if (spot) {
    const s = spot.querySelector('svg');
    if (s) s.outerHTML = Icons.get('search', { size: 13 });
  }
  document.getElementById('tb-clock').insertAdjacentHTML('afterbegin',
    `<span style="margin-right:6px;display:flex;align-items:center">${Icons.get('clock', { size: 14 })}</span>`);

  Widgets.refresh();
  setInterval(Widgets.refresh, 3000);
  setInterval(() => Widgets.initWeather(), 10 * 60 * 1000);
  setInterval(Widgets.tickClock, 1000);

  // menu-bar slide-down panels
  MBPanel.bind();

  // calendar popup on clock click
  document.getElementById('tb-clock').onclick = e => { e.stopPropagation(); Calendar.toggle(); };
  document.getElementById('cal-pop').addEventListener('click', e => e.stopPropagation());

  // power / sign-out (only meaningful when auth is on)
  document.getElementById('tb-power').onclick = hemioLogout;
  try {
    const st = await API.get('/api/auth/status');
    document.getElementById('tb-power').style.display = st.enabled ? '' : 'none';
  } catch {}

  // dock
  const dockHandlers = {
    launchpad: () => Launchpad.isOpen() ? Launchpad.close() : Launchpad.open(),
    notes: openNotes,
    files: () => FilesModule.open(),
    monitor: openActivity,
    settings: () => Settings.open(),
    home: openAbout,
  };
  document.querySelectorAll('.dock-item').forEach(b => {
    b.onclick = () => { const h = dockHandlers[b.dataset.dock]; h && h(); refreshDockDots(); };
  });
  document.getElementById('spotlight').onclick = () => Spotlight.open();

  // keyboard: ⌘K / Ctrl+K (or ⌘Space) spotlight, Esc closes overlays
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === ' ')) {
      e.preventDefault();
      Spotlight.isOpen() ? Spotlight.close() : Spotlight.open();
    } else if (e.key === 'Escape') {
      Spotlight.close(); Launchpad.close();
    }
  });

  refreshDockDots();
})();
