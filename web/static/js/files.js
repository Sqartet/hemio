// files.js — macOS Finder-style file browser window
const FilesModule = (() => {
  let cwd = '';
  let view = localStorage.getItem('hemio_view') || 'grid';

  const FOLDER_SVG = '<svg viewBox="0 0 24 24" width="42" height="42"><path d="M2.5 7.2A2.2 2.2 0 0 1 4.7 5h4.1a2.2 2.2 0 0 1 1.6.7l1 1.1h7.9a2.2 2.2 0 0 1 2.2 2.2v8.8A2.2 2.2 0 0 1 19.3 20H4.7a2.2 2.2 0 0 1-2.2-2.2V7.2Z" fill="#54aaff"/></svg>';
  const FOLDER16 = '<svg viewBox="0 0 24 24" width="16" height="16" style="display:block;flex:none"><path d="M2.5 7.2A2.2 2.2 0 0 1 4.7 5h4.1a2.2 2.2 0 0 1 1.6.7l1 1.1h7.9a2.2 2.2 0 0 1 2.2 2.2v8.8A2.2 2.2 0 0 1 19.3 20H4.7a2.2 2.2 0 0 1-2.2-2.2V7.2Z" fill="#54aaff"/></svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));

  function openWindow(path) {
    if (path !== undefined && path !== null) cwd = path;
    const w = WinMgr.create('files', 'Files', { width: 720, height: 460, icon: Icons.get('folder', { size: 14 }) });
    const body = w.querySelector('.win-body');
    body.style.padding = '12px';
    body.innerHTML = '';

    const split = el('div', 'fx-split');
    body.append(split);

    // ---------- sidebar ----------
    const side = el('div', 'fx-side');
    side.innerHTML = `
      <div class="fx-sect">FAVORITES</div>
      <button class="fx-link" data-p=""><span class="fi">${Icons.get('home', { size: 13 })}</span>Home</button>
      <div class="fx-sect">TAGS</div>
      <button class="fx-link" data-p="__recent"><span class="fi">${Icons.get('clock2', { size: 13 })}</span>Recent</button>
      <div class="fx-storage">
        <div class="lbl"><span>Storage</span><span id="fx-st-t">…</span></div>
        <div class="track"><i id="fx-st-bar"></i></div>
      </div>`;
    split.append(side);

    // ---------- main panel ----------
    const main = el('div', 'fx-main');
    const bar = el('div', 'fx-toolbar');
    bar.innerHTML = `
      <button class="fx-tool" id="fxb-back" title="Back">${Icons.get('chevronLeft', { size: 15 })}</button>
      <button class="fx-tool" id="fxb-fwd" title="Forward">${Icons.get('chevronRight', { size: 15 })}</button>
      <button class="fx-tool" id="fx-up" title="Enclosing folder">${Icons.get('chevronUp', { size: 15 })}</button>
      <button class="fx-tool" id="fxb-new" title="New folder">${Icons.get('plus', { size: 15 })}</button>
      <button class="fx-tool" id="fxb-ref" title="Refresh">${Icons.get('refresh', { size: 15 })}</button>
      <button class="fx-tool" id="fxb-upl" title="Upload files" style="position:relative">${Icons.get('upload', { size: 15 })}<input type="file" id="fx-file" multiple hidden></button>
      <span style="flex:1"></span>
      <input class="fx-search" id="fx-q" placeholder="Search..." autocomplete="off">
      <button class="fx-tool ${view === 'grid' ? 'sel' : ''}" id="fx-v-g" title="as icons">${Icons.get('grid', { size: 15 })}</button>
      <button class="fx-tool ${view === 'list' ? 'sel' : ''}" id="fx-v-l" title="as list">${Icons.get('list', { size: 15 })}</button>`;
    const crumbbar = el('div', 'fx-crumbbar');
    crumbbar.innerHTML = '<span class="fx-crumbs" id="fx-crumbs"></span>';
    const content = el('div', view === 'grid' ? 'fx-grid' : 'fx-list');
    const status = el('div', 'fx-status');
    status.innerHTML = '<span>...</span><span></span>';
    main.append(bar, crumbbar, content, status);
    split.append(main);

    // ---------- history (back / forward) ----------
    let hist = [cwd], hi = 0;
    function paintNav() {
      bar.querySelector('#fxb-back').disabled = hi <= 0;
      bar.querySelector('#fxb-fwd').disabled = hi >= hist.length - 1;
    }
    function go(p) {                    // a user navigation: push into history
      if (p === hist[hi]) { load(p); return; }
      hist = hist.slice(0, hi + 1);
      hist.push(p); hi = hist.length - 1;
      load(p);
    }
    bar.querySelector('#fxb-back').onclick = () => { if (hi > 0) { hi--; load(hist[hi]); } };
    bar.querySelector('#fxb-fwd').onclick = () => { if (hi < hist.length - 1) { hi++; load(hist[hi]); } };

    // ---------- breadcrumb ----------
    function paintCrumbs(label) {
      const cr = crumbbar.querySelector('#fx-crumbs');
      const parts = cwd.split('/').filter(Boolean);
      let html = `<button class="fx-crumb${parts.length ? '' : ' cur'}" data-p="">${Icons.get('home', { size: 12 })}<span>Home</span></button>`;
      let acc = [];
      for (let i = 0; i < parts.length; i++) {
        acc.push(parts[i]);
        const p = acc.join('/');
        html += `<span class="fx-crumb-sep">${Icons.get('chevronRight', { size: 10 })}</span>`;
        html += `<button class="fx-crumb${i === parts.length - 1 && !label ? ' cur' : ''}" data-p="${esc(p)}"><span>${esc(parts[i])}</span></button>`;
      }
      if (label) html += `<span class="fx-crumb-sep">${Icons.get('chevronRight', { size: 10 })}</span><span class="fx-crumb cur">${esc(label)}</span>`;
      cr.innerHTML = html;
      cr.querySelectorAll('.fx-crumb[data-p]').forEach(b => b.onclick = () => go(b.dataset.p));
    }

    // ---------- wiring ----------
    side.querySelectorAll('.fx-link').forEach(b => b.onclick = () => {
      if (b.dataset.p === '__recent') loadTags();
      else go(b.dataset.p || '');
    });

    bar.querySelector('#fx-up').onclick = () => {
      const parts = cwd.split('/').filter(Boolean); parts.pop(); go(parts.join('/'));
    };
    bar.querySelector('#fxb-ref').onclick = () => load(cwd);
    bar.querySelector('#fxb-new').onclick = async () => {
      const name = prompt('New folder name:');
      if (!name) return;
      try {
        await fetch('/api/files/mkdir?path=' + encodeURIComponent(cwd ? cwd + '/' + name : name), { method: 'POST' });
        load(cwd);
      } catch (e) { toast('Failed: ' + e.message); }
    };
    // ---------- upload (button + drag & drop) ----------
    const upBtn = bar.querySelector('#fxb-upl');
    const fileIn = bar.querySelector('#fx-file');
    upBtn.onclick = () => fileIn.click();
    fileIn.onchange = () => { uploadFiles(fileIn.files); fileIn.value = ''; };
    main.addEventListener('dragover', e => { e.preventDefault(); main.classList.add('fx-drop-hint'); });
    main.addEventListener('dragleave', e => { if (!main.contains(e.relatedTarget)) main.classList.remove('fx-drop-hint'); });
    main.addEventListener('drop', e => {
      e.preventDefault();
      main.classList.remove('fx-drop-hint');
      if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
    });

    async function uploadFiles(files) {
      if (!files || !files.length) return;
      upBtn.classList.add('uploading');
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      try {
        const r = await fetch('/api/files/upload?path=' + encodeURIComponent(cwd), { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.text()).trim() || r.status);
        const d = await r.json();
        toast(`Uploaded ${d.saved.length} file${d.saved.length === 1 ? '' : 's'} to /${cwd}`);
        load(cwd);
      } catch (e) {
        toast('Upload failed: ' + e.message);
      } finally {
        upBtn.classList.remove('uploading');
      }
    }
    const q = bar.querySelector('#fx-q');
    let qTimer;
    q.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => render(cwd, q.value.trim()), 160); };
    const gBtn = bar.querySelector('#fx-v-g'), lBtn = bar.querySelector('#fx-v-l');
    gBtn.onclick = () => setView('grid');
    lBtn.onclick = () => setView('list');

    let lastData = null;

    function setView(v) {
      view = v; localStorage.setItem('hemio_view', v);
      gBtn.classList.toggle('sel', v === 'grid');
      lBtn.classList.toggle('sel', v === 'list');
      content.className = v === 'grid' ? 'fx-grid' : 'fx-list';
      if (lastData) render(cwd, q.value.trim());
    }

    async function load(path) {
      cwd = path || '';
      q.value = '';
      paintCrumbs(); paintNav();
      content.innerHTML = '<div style="color:var(--dim);padding:20px">Loading…</div>';
      try {
        const data = await API.get(API.file(cwd));
        lastData = data;
        render(cwd, '');
        const entries = data.entries || [];
        const dirs = entries.filter(e => e.is_dir).length;
        status.children[0].textContent = `${dirs} folder${dirs === 1 ? '' : 's'}, ${entries.length - dirs} file${entries.length - dirs === 1 ? '' : 's'}`;
        status.children[1].textContent = '/' + cwd;
        const stT = side.querySelector('#fx-st-t'), stB = side.querySelector('#fx-st-bar');
        if (stT && data.total) {
          const used = data.total - data.free;
          stT.textContent = `${fmtBytes(used)} / ${fmtBytes(data.total)}`;
          stB.style.width = Math.min(100, 100 * used / data.total) + '%';
        }
      } catch (e) {
        content.innerHTML = `<div class="fx-err">${Icons.get('info', { size: 15, color: '#ff6b6b' })} ${e.message.includes('403') ? 'Access restricted to the configured folder.' : esc(e.message)}</div>`;
      }
    }

    async function loadTags() {
      // "Recent": just relabel + sort current listing by mtime desc, stay in cwd
      paintCrumbs('Recent');
      paintNav();
      if (lastData) {
        const sorted = [...(lastData.entries || [])].sort((a, b) => b.mod - a.mod).slice(0, 60);
        drawList(sorted, '/recent');
      }
    }

    function render(_cwd, filter) {
      if (!lastData) return;
      let entries = lastData.entries || [];
      if (filter) entries = entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
      drawList(entries, '/' + cwd);
    }

    function drawList(entries, pathLabel) {
      status.children[1].textContent = pathLabel;
      if (view === 'grid') {
        content.className = 'fx-grid';
        content.innerHTML = '';
        for (const e of entries) {
          const it = el('div', 'fx-item');
          it.innerHTML = `<div class="big">${e.is_dir ? FOLDER_SVG : iconFor(e.name, 38)}</div><div class="lbl2">${esc(e.name)}</div>`;
          it.onclick = () => pick(e);
          content.append(it);
        }
        if (!entries.length) content.innerHTML = `<div style="color:var(--dim);padding:20px;grid-column:1/-1;text-align:center">Empty folder</div>`;
      } else {
        content.className = 'fx-list';
        const t = el('table');
        t.innerHTML = `<thead><tr><th>Name</th><th style="width:90px">Size</th><th style="width:130px">Modified</th></tr></thead>`;
        const tb = el('tbody');
        for (const e of entries) {
          const tr = el('tr');
          tr.innerHTML = `<td><span class="fx-cell">${e.is_dir ? FOLDER16 : iconFor(e.name)}<span>${esc(e.name)}</span></span></td>
            <td style="color:var(--dim);font-family:var(--mono);font-size:11.5px">${e.is_dir ? '—' : fmtBytes(e.size)}</td>
            <td style="color:var(--dim);font-family:var(--mono);font-size:11.5px">${new Date(e.mod * 1000).toLocaleDateString()}</td>`;
          tr.onclick = () => pick(e);
          tb.append(tr);
        }
        t.append(tb);
        content.innerHTML = '';
        content.append(t);
      }
    }

    function pick(e) {
      if (e.is_dir) {
        // entering from a "recent"/filtered view is fine — absolute paths resolve
        go(e.path);
      } else {
        location.href = API.download(e.path);
      }
    }

    load(cwd);
    return w;
  }

  function iconFor(name, size) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const I = n => Icons.get(n, { size: size || 16 });
    const map = {
      png:'image', jpg:'image', jpeg:'image', gif:'image', webp:'image', svg:'image', ico:'image', bmp:'image',
      mp4:'video', mkv:'video', avi:'video', mov:'video', webm:'video',
      mp3:'music', flac:'music', wav:'music', ogg:'music',
      pdf:'pdf', doc:'doc', docx:'doc', xls:'doc', xlsx:'doc', ppt:'doc', pptx:'doc', odt:'doc',
      zip:'archive', rar:'archive', '7z':'archive', tar:'archive', gz:'archive',
      js:'fileCode', ts:'fileCode', py:'fileCode', go:'fileCode', rs:'fileCode', java:'fileCode', c:'fileCode', h:'fileCode', cpp:'fileCode', cs:'fileCode', rb:'fileCode', php:'fileCode', sh:'fileCode', bat:'fileCode',
      html:'fileCode', css:'fileCode',
      txt:'file', md:'file', log:'file', json:'file', yaml:'file', yml:'file', xml:'file', toml:'file', ini:'file', env:'file' };
    return I(map[ext] || 'file');
  }

  return { open: path => openWindow(path) };
})();
