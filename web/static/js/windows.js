// windows.js — macOS-style draggable windows with traffic lights
const WinMgr = (() => {
  const layer = document.getElementById('win-layer');
  let z = 10;
  const open = new Map(); // key -> {el}
  let cascade = 0;

  const FOLDER15 = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M2.5 7.2A2.2 2.2 0 0 1 4.7 5h4.1a2.2 2.2 0 0 1 1.6.7l1 1.1h7.9a2.2 2.2 0 0 1 2.2 2.2v8.8A2.2 2.2 0 0 1 19.3 20H4.7a2.2 2.2 0 0 1-2.2-2.2V7.2Z" fill="#54aaff"/></svg>';

  function focusOn(rec) {
    open.forEach(o => o.el.classList.remove('active'));
    rec.el.classList.add('active');
    rec.el.style.zIndex = ++z + 10;
  }

  function create(key, title, opts = {}) {
    const existing = open.get(key);
    if (existing) { existing.el.style.display = ''; focusOn(existing); return existing.el; }

    const w = el('div', 'win');
    const off = (cascade++ % 6) * 26;
    const vw = innerWidth, vh = innerHeight;
    const mobile = vw <= 640;
    const width = Math.min(opts.width || 560, vw - (mobile ? 12 : 30));
    const height = Math.min(opts.height || 380, vh - (mobile ? 132 : 90));
    w.style.width = width + 'px';
    w.style.height = height + 'px';
    if (opts.fit) { w.style.height = 'auto'; w.classList.add('fit'); }
    if (mobile) {
      w.style.left = '6px';
      w.style.top = '42px';
    } else {
      w.style.left = Math.max(12, Math.min(vw - width - 12, vw * 0.18 + off)) + 'px';
      w.style.top = Math.max(52, Math.min(vh - height - 110, 96 + off)) + 'px';
    }

    const head = el('div', 'win-head');
    head.innerHTML = `
      <div class="lights">
        <button class="light close" title="Close"></button>
        <button class="light min" title="Minimize"></button>
        <button class="light max" title="Maximize"></button>
      </div>
      <div class="win-title">${opts.icon || FOLDER15}<span>${title}</span></div>`;
    const body = el('div', 'win-body');
    const grip = el('div', 'win-resize');
    w.append(head, body, grip);
    layer.append(w);

    const rec = { el: w };
    open.set(key, rec);
    focusOn(rec);
    w.addEventListener('mousedown', () => focusOn(rec));

    head.querySelector('.light.close').onclick = e => {
      e.stopPropagation(); w.remove(); open.delete(key); opts.onClose && opts.onClose();
      refreshDockDots();
    };
    head.querySelector('.light.min').onclick = e => { e.stopPropagation(); w.style.display = 'none'; };
    const maxBtn = head.querySelector('.light.max');
    let restore = null;
    maxBtn.onclick = e => {
      e.stopPropagation();
      if (!restore) {
        restore = { l: w.style.left, t: w.style.top, wid: w.style.width, hei: w.style.height };
        w.style.left = '10px'; w.style.top = '52px';
        w.style.width = (innerWidth - 20) + 'px';
        w.style.height = (innerHeight - 120) + 'px';
      } else {
        Object.assign(w.style, { left: restore.l, top: restore.t, width: restore.wid, height: restore.hei });
        restore = null;
      }
    };

    // drag by header (not on lights)
    head.addEventListener('pointerdown', e => {
      if (e.target.closest('.light')) return;
      const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
      head.setPointerCapture(e.pointerId);
      const move = ev => {
        w.style.left = Math.max(-w.offsetWidth + 140, Math.min(innerWidth - 60, ev.clientX - sx)) + 'px';
        w.style.top = Math.max(52, Math.min(innerHeight - 40, ev.clientY - sy)) + 'px';
      };
      const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
    });

    grip.addEventListener('pointerdown', e => {
      e.preventDefault();
      const sw = w.offsetWidth - e.clientX, sh = w.offsetHeight - e.clientY;
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        w.style.width = Math.max(300, sw + ev.clientX) + 'px';
        w.style.height = Math.max(180, sh + ev.clientY) + 'px';
      };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });

    refreshDockDots();
    return w;
  }

  // size a fit-window to its content (no scrollbar)
  function fit(w) {
    if (!w.classList.contains('fit')) return;
    const head = w.querySelector('.win-head'), body = w.querySelector('.win-body');
    // Temporarily let CSS auto-size while we measure content height.
    w.style.height = 'auto';
    const h = head.offsetHeight + body.scrollHeight + 2;
    // Clamp to viewport with margin, then fix it for the dragging logic.
    const clamped = Math.min(h, innerHeight - (innerWidth <= 640 ? 140 : 120));
    w.style.height = clamped + 'px';
    body.style.overflow = (h > clamped) ? 'auto' : 'hidden';
  }

  // register a fit-window so a ResizeObserver can keep it snug
  function watchFit(w) {
    if (!w.classList.contains('fit') || !window.ResizeObserver) return;
    const ro = new ResizeObserver(entries => {
      if (!w.isConnected) { ro.disconnect(); return; }
      fit(w);
    });
    ro.observe(w.querySelector('.win-body'));
  }

  // Win+D style: hide all windows, remember who was visible, restore later
  let hiddenByDesk = null;
  function minimizeAll() {
    hiddenByDesk = [];
    open.forEach(rec => {
      if (rec.el.style.display !== 'none') { hiddenByDesk.push(rec); rec.el.style.display = 'none'; }
    });
  }
  function restoreAll() {
    (hiddenByDesk || []).forEach(rec => { if (rec.el.isConnected) rec.el.style.display = ''; });
    hiddenByDesk = null;
  }

  return { create, fit, watchFit, minimizeAll, restoreAll, hasHidden: () => !!hiddenByDesk, has: k => open.has(k), get: k => open.get(k) && open.get(k).el };
})();
