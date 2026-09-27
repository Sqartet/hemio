// grid.js — desktop squircle app tiles + Launchpad tiles
const Grid = (() => {
  let apps = [];
  let lastHealth = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // keyword -> icon name + macOS-ish app gradient
  const HINTS = [
    [/(adguard|pihole|dns|blocker)/i, 'shield', 'linear-gradient(160deg,#4caf6d,#2f8f52)'],
    [/(jellyfin|plex|emby|media|cinema|kodi)/i, 'play', 'linear-gradient(160deg,#6a4fd0,#4a2fa8)'],
    [/(home assistant|hass|hassio)/i, 'home', 'linear-gradient(160deg,#38a1ff,#1f6fd0)'],
    [/(router|gateway|openwrt|unifi|network)/i, 'wifi', 'linear-gradient(160deg,#48b8c8,#26889a)'],
    [/(syncthing|sync|nextcloud|backup)/i, 'sync', 'linear-gradient(160deg,#40a0e0,#2478b8)'],
    [/(uptime|kuma|monitor|status|grafana|prometheus)/i, 'activity', 'linear-gradient(160deg,#f0a04b,#d0752a)'],
    [/(transmission|qbit|torrent|deluge|download)/i, 'download', 'linear-gradient(160deg,#5f8fd0,#3c65a8)'],
    [/(portainer|docker|container|proxmox)/i, 'server', 'linear-gradient(160deg,#3d8fd0,#25618f)'],
    [/(proxmox|virtual|vmware)/i, 'server', 'linear-gradient(160deg,#e0714f,#b34a2c)'],
    [/(wiki|docs|notion|obsidian|notes|memo)/i, 'note', 'linear-gradient(160deg,#7d7f88,#55575f)'],
    [/(git|gitea|forgejo|code)/i, 'chip', 'linear-gradient(160deg,#e0724f,#b84a2c)'],
    [/(vault|auth|password|authelia|keycloak)/i, 'lock', 'linear-gradient(160deg,#c9a13a,#9c7722)'],
    [/(paperless|scan|docs)/i, 'note', 'linear-gradient(160deg,#8a9a6a,#61704a)'],
    [/(homebox|inventory|book|library|calibre)/i, 'folder', 'linear-gradient(160deg,#d0a04c,#a87826)'],
    [/(photo|immich|image|gallery)/i, 'chart', 'linear-gradient(160deg,#e0709a,#b84878)'],
    [/(mail|smtp|imap|roundcube)/i, 'note', 'linear-gradient(160deg,#4f9ad0,#2f6ea0)'],
  ];
  const SYM = {
    shield: '<path d="M12 3.2 5 6v6.2c0 4.3 3 7.6 7 8.6 4-1 7-4.3 7-8.6V6Z"/>',
    play: '<path d="M8.4 5.6 18 12l-9.6 6.4Z"/>',
    home: '<path d="M12 4.4 4.6 10.6V19h5v-5h4.8v5h5v-8.4Z"/>',
    wifi: '<path d="M4.6 9.6a11 11 0 0 1 14.8 0M7.6 12.8a6.6 6.6 0 0 1 8.8 0M10.4 15.8a2.6 2.6 0 0 1 3.2 0"/><circle cx="12" cy="18.6" r="1.1"/>',
    sync: '<path d="M5 12a7 7 0 0 1 11.6-5.2M19 12a7 7 0 0 1-11.6 5.2"/><path d="M16.4 3.4v3.6H20M7.6 20.6V17H4"/>',
    activity: '<path d="M3.4 12h3.4l2.2-5.2 3.4 10.8 2.6-7 1.8 3.4h4.4"/>',
    download: '<path d="M12 4.6V15"/><path d="M7.6 10.6 12 15l4.4-4.4"/><path d="M4.8 18v1.4a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6V18"/>',
    server: '<rect x="3.4" y="4.6" width="17.2" height="6.2" rx="2"/><rect x="3.4" y="13.2" width="17.2" height="6.2" rx="2"/><path d="M7.2 7.7h.01M7.2 16.3h.01"/>',
    note: '<path d="M6.4 3.6h8L18.6 8v12.4H6.4Z"/><path d="M14.2 3.8v4.4h4.2"/><path d="M9.2 12.6h6M9.2 15.8h4"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2.2"/><path d="M10 3.6v3.4M14 3.6v3.4M10 17v3.4M14 17v3.4M3.6 10H7M3.6 14H7M17 10h3.4M17 14h3.4"/>',
    lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.6"/><path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4"/>',
    folder: '<path d="M3.4 7.6a2.4 2.4 0 0 1 2.4-2.4h3l2.4 2.6h7a2.4 2.4 0 0 1 2.4 2.4v7.2a2.4 2.4 0 0 1-2.4 2.4H5.8a2.4 2.4 0 0 1-2.4-2.4Z"/>',
    chart: '<rect x="5" y="11.4" width="3.4" height="8.2" rx="1.2"/><rect x="10.3" y="6.6" width="3.4" height="13" rx="1.2"/><rect x="15.6" y="14" width="3.4" height="5.6" rx="1.2"/>',
  };

  function hintFor(title) {
    for (const [re, sym, bg] of HINTS) if (re.test(title)) return { sym, bg };
    return null;
  }

  async function load() {
    try { apps = await API.get('/api/apps'); } catch (e) { apps = []; }
    render('');
  }

  function tileFor(a) {
    const title = a.title || a.url || 'App';
    const hue = [...title].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
    const t = el('div', 'app-tile');
    t.dataset.app = title;
    const st = lastHealth[title];
    const dotCls = st ? (st.healthy ? 'st ok' : 'st bad') : (a.health_check ? 'st' : 'st');
    const hint = hintFor(title);
    let inner;
    if (a.icon) {
      inner = `<img src="${esc(a.icon)}" style="width:58%;height:58%;object-fit:contain" alt="">`;
    } else if (hint) {
      inner = `<svg viewBox="0 0 24 24" width="46%" height="46%" fill="none" stroke="#fff"
        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${SYM[hint.sym]}</svg>`;
    } else {
      inner = esc([...title][0] ? [...title][0].toUpperCase() : '?');
    }
    const bg = a.icon ? '#fff' : (hint ? hint.bg : `linear-gradient(160deg,hsl(${hue} 68% 60%),hsl(${(hue + 40) % 360} 68% 44%))`);
    t.innerHTML = `
      <div class="sq" style="background:${bg}">
        <span class="${dotCls}"></span>${inner}
      </div>
      <div class="nm">${esc(title)}</div>`;
    t.title = a.description || a.url || '';
    t.onclick = () => window.open(a.url, '_blank', 'noopener');
    return t;
  }

  function render(filter) {
    const root = document.getElementById('app-row');
    root.innerHTML = '';
    const f = (filter || '').toLowerCase();
    const list = apps.filter(a => !f || ((a.title || '') + ' ' + (a.category || '')).toLowerCase().includes(f));
    if (!list.length) {
      root.innerHTML = `<div style="color:var(--dim);padding:40px 10px;text-shadow:0 1px 3px rgba(0,0,0,.6);font-size:13px">
        No apps — edit <b>apps.json</b> next to the Hemio binary.</div>`;
      return;
    }
    for (const a of list) root.append(tileFor(a));
  }

  function updateHealth(map) {
    lastHealth = map || {};
    document.querySelectorAll('#app-row .app-tile').forEach(t => {
      const st = lastHealth[t.dataset.app];
      const dot = t.querySelector('.st');
      if (!dot) return;
      dot.className = 'st ' + (st ? (st.healthy ? 'ok' : 'bad') : '');
    });
  }

  return { load, render, updateHealth, all: () => apps, tileFor };
})();
