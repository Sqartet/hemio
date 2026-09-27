// icons.js — macOS-style monochrome line icons (SF-Symbols-ish), inline SVG.
// Usage: Icons.get('battery', {size:14}) -> svg string
const Icons = (() => {
  const S = (p, o = {}) => {
    const size = o.size || 14;
    const w = o.sw || 1.7;
    const color = o.color || 'currentColor';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"
      style="display:inline-block;vertical-align:middle;flex:none">${p}</svg>`;
  };

  const defs = {
    // ---------- status / menu bar ----------
    battery: o => S(`<rect x="1.5" y="7" width="17" height="10" rx="3"/>
        <path d="M21 10.5v3"/><rect x="4" y="9.5" width="3" height="5" rx="1" fill="${o.fill || '#2ecc71'}" stroke="none"/>`, o),
    batteryFull: o => {
      const pct = Math.max(0, Math.min(100, o.pct ?? 100));
      const w = Math.max(1.2, 11 * pct / 100);
      const col = pct <= 20 ? '#ff5f57' : pct <= 45 ? '#febc2e' : '#2ecc71';
      return S(`<rect x="1.5" y="7" width="17" height="10" rx="3"/>
        <path d="M21 10.5v3"/><rect x="4" y="9.5" width="${w.toFixed(2)}" height="5" rx="1" fill="${col}" stroke="none"/>`, o);
    },
    charging: o => S(`<rect x="1.5" y="7" width="17" height="10" rx="3"/><path d="M21 10.5v3"/>
        <path d="M10.6 8.8 7.4 12.6h2.7l-.7 2.7 3.2-3.8h-2.7l.7-2.7Z" fill="#2ecc71" stroke="none"/>`, o),
    wifi: o => S(`<path d="M2.5 9.2a14 14 0 0 1 19 0"/><path d="M5.6 12.4a9.5 9.5 0 0 1 12.8 0"/>
        <path d="M8.7 15.6a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19" r="1.15" fill="currentColor" stroke="none"/>`, o),
    wifiOff: o => S(`<path d="M2.5 9.2a14 14 0 0 1 8-3.9"/><path d="M16.6 6.2a14 14 0 0 1 4.9 3"/>
        <path d="M5.6 12.4a9.5 9.5 0 0 1 4.3-2.3"/><path d="M8.7 15.6a5 5 0 0 1 6.6 0"/>
        <circle cx="12" cy="19" r="1.15" fill="currentColor" stroke="none"/><path d="M3.5 3.5l17 17"/>`, o),
    ethernet: o => S(`<rect x="3" y="9" width="18" height="10" rx="2.5"/>
        <path d="M7.5 9V6.5h9V9"/><path d="M8 19v2.2M12 19v2.2M16 19v2.2"/>`, o),
    cloud: o => S(`<path d="M7.2 18.5h9.6a4.3 4.3 0 0 0 .5-8.55A5.8 5.8 0 0 0 6.3 10.9a3.85 3.85 0 0 0 .9 7.6Z"/>`, o),
    bell: o => S(`<path d="M12 3.2a5.6 5.6 0 0 0-5.6 5.6v3.7L4.8 16a.9.9 0 0 0 .8 1.4h12.8a.9.9 0 0 0 .8-1.4l-1.6-3.5V8.8A5.6 5.6 0 0 0 12 3.2Z"/>
        <path d="M10 20a2 2 0 0 0 4 0"/>`, o),
    clock: o => S(`<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 1.9"/>`, o),
    power: o => S(`<path d="M12 3.4v7.4"/><path d="M6.6 6.5a8 8 0 1 0 10.8 0"/>`, o),
    search: o => S(`<circle cx="11" cy="11" r="6.4"/><path d="M16 16l4.2 4.2"/>`, o),
    lock: o => S(`<rect x="4.6" y="10.4" width="14.8" height="9.4" rx="2.6"/>
        <path d="M8 10.4V7.9a4 4 0 0 1 8 0v2.5"/>`, o),
    user: o => S(`<circle cx="12" cy="8.4" r="3.9"/><path d="M4.8 20.2c1.3-3.5 4-5.3 7.2-5.3s5.9 1.8 7.2 5.3"/>`, o),

    // ---------- widget rail ----------
    cpu: o => S(`<rect x="7" y="7" width="10" height="10" rx="2.4"/>
        <path d="M10 3.4v3.6M14 3.4v3.6M10 17v3.6M14 17v3.6M3.4 10H7M3.4 14H7M17 10h3.6M17 14h3.6"/>`, o),
    chip: o => S(`<rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.6"/>
        <rect x="10" y="10" width="4" height="4" rx="1"/>
        <path d="M9.6 3.6v2.8M14.4 3.6v2.8M9.6 17.6v2.8M14.4 17.6v2.8M3.6 9.6h2.8M3.6 14.4h2.8M17.6 9.6h2.8M17.6 14.4h2.8"/>`, o),
    memory: o => S(`<rect x="2.6" y="7.4" width="18.8" height="9.2" rx="2.6"/>
        <path d="M6.6 16.6v2.6M12 16.6v2.6M17.4 16.6v2.6"/><path d="M6.4 10.6v2.8M10.4 10.6v2.8M14.4 10.6v2.8M18.2 10.6v2.8"/>`, o),
    disk: o => S(`<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.4"/>
        <path d="M14 10.2 17 7.4"/>`, o),
    network: o => S(`<circle cx="12" cy="19" r="2.1"/><path d="M8.2 15.1a5.6 5.6 0 0 1 7.6 0"/>
        <path d="M5 11.9a10.2 10.2 0 0 1 14 0"/><path d="M1.9 8.6a14.7 14.7 0 0 1 20.2 0"/>`, o),
    thermo: o => S(`<path d="M14 14.4V5.6a2 2 0 1 0-4 0v8.8a3.7 3.7 0 1 0 4 0Z"/><path d="M12 17.6v-6"/>`, o),
    apps: o => S(`<rect x="3.4" y="3.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="3.4" width="7.2" height="7.2" rx="2"/>
        <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="2"/><rect x="13.4" y="13.4" width="7.2" height="7.2" rx="2"/>`, o),
    server: o => S(`<rect x="3" y="4.4" width="18" height="6.6" rx="2.2"/><rect x="3" y="13" width="18" height="6.6" rx="2.2"/>
        <path d="M7 7.7h.01M7 16.3h.01"/>`, o),
    activity: o => S(`<path d="M2.6 12h3.6l2.2-5.4 3.4 11 2.6-7 1.8 3.4h5.2"/>`, o),
    uptime: o => S(`<circle cx="12" cy="13" r="7.6"/><path d="M12 8.6V13l2.9 1.7"/><path d="M9 2.8h6"/>`, o),

    // ---------- settings / misc ----------
    gear: o => S(`<circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>`, o),
    paint: o => S(`<path d="M4.6 8.6A7.6 7.6 0 0 1 19.4 8"/> <rect x="3" y="8.4" width="18" height="5.4" rx="2"/>
        <path d="M12 13.8v2.6a2 2 0 0 0 2 2h.6"/>`, o),
    monitor: o => S(`<rect x="2.6" y="4.2" width="18.8" height="12.4" rx="2.4"/><path d="M9.4 20.2h5.2M12 16.6v3.6"/>`, o),
    info: o => S(`<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><circle cx="12" cy="8.1" r="1" fill="currentColor" stroke="none"/>`, o),
    folder: o => S(`<path d="M3.2 7.4a2.4 2.4 0 0 1 2.4-2.4h3.1l2.1 2.4h7.6a2.4 2.4 0 0 1 2.4 2.4v7.6a2.4 2.4 0 0 1-2.4 2.4H5.6a2.4 2.4 0 0 1-2.4-2.4Z"/>`, o),
    note: o => S(`<path d="M6 3.4h8.6L19 7.8v12.8H6Z"/><path d="M14.2 3.6v4.4H19"/><path d="M9 12.4h6M9 15.8h4"/>`, o),
    chart: o => S(`<path d="M4 19.6h16"/><rect x="5.6" y="11" width="3.4" height="8.6" rx="1.2"/>
        <rect x="10.4" y="6.4" width="3.4" height="13.2" rx="1.2"/><rect x="15.2" y="13.6" width="3.4" height="6" rx="1.2"/>`, o),
    upload: o => S(`<path d="M12 16V4.6"/><path d="M7.6 9 12 4.6 16.4 9"/><path d="M4.4 15.4v3.2a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2v-3.2"/>`, o),
    hexagon: o => S(`<path d="M12 2.6 20.2 7v10L12 21.4 3.8 17V7Z"/><path d="M12 8.4v7.2M8.8 10.2l6.4 3.6M15.2 10.2l-6.4 3.6"/>`, o),
    grip: o => S(`<path d="M8 6.4h.01M8 12h.01M8 17.6h.01M16 6.4h.01M16 12h.01M16 17.6h.01"/>`, { ...o, sw: 2.6 }),
    download: o => S(`<path d="M12 4.6V16"/><path d="M7.6 11.6 12 16l4.4-4.4"/><path d="M4.4 17.4v1.2a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2v-1.2"/>`, o),

    // ---------- window toolbar / file-type icons ----------
    home: o => S(`<path d="M4 10.8 12 4l8 6.8"/><path d="M6 9.5v9a1.4 1.4 0 0 0 1.4 1.4h9.2A1.4 1.4 0 0 0 18 18.5v-9"/><path d="M10 20v-5.6h4V20"/>`, o),
    clock2: o => S(`<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 1.9"/>`, o),
    drive: o => S(`<rect x="2.6" y="13.4" width="18.8" height="6.6" rx="2.4"/><path d="M5.6 13.4 8.4 4.4h9.6l2.8 9"/><path d="M6.4 16.7h.01M9.8 16.7h.01"/>`, o),
    chevronUp: o => S(`<path d="M6 14.5 12 8.5l6 6"/>`, o),
    chevronLeft: o => S(`<path d="M14.5 6 8.5 12l6 6"/>`, o),
    chevronRight: o => S(`<path d="M9.5 6l6 6-6 6"/>`, o),
    plus: o => S(`<path d="M12 5v14M5 12h14"/>`, o),
    refresh: o => S(`<path d="M20 11.5a8 8 0 1 0-2.3 6.1"/><path d="M20 5v6.5h-6.5"/>`, o),
    grid: o => S(`<rect x="3.6" y="3.6" width="7" height="7" rx="1.6"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.6"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.6"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.6"/>`, o),
    list: o => S(`<path d="M9 6.4h11M9 12h11M9 17.6h11"/><circle cx="5.2" cy="6.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.2" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.2" cy="17.6" r="1.1" fill="currentColor" stroke="none"/>`, o),
    file: o => S(`<path d="M6.4 3.6h7L18.4 8.6v11.8H6.4Z"/><path d="M13.2 3.6v5h5"/>`, o),
    fileCode: o => S(`<path d="M6.4 3.6h7L18.4 8.6v11.8H6.4Z"/><path d="M13.2 3.6v5h5"/><path d="M10.8 12.4 8.6 14.6l2.2 2.2M14 12.4l2.2 2.2-2.2 2.2"/>`, o),
    image: o => S(`<rect x="3.4" y="5" width="17.2" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.7"/><path d="m4.6 17.4 4.6-4.2 3.2 3 2.8-2.4 4.2 3.6"/>`, o),
    video: o => S(`<rect x="2.6" y="5.6" width="13.6" height="12.8" rx="2.4"/><path d="m16.2 10.4 5.2-3.2v9.6l-5.2-3.2Z"/>`, o),
    music: o => S(`<path d="M9.4 17.6V5.8l9-1.9v11.6"/><circle cx="7" cy="17.9" r="2.4"/><circle cx="16" cy="15.9" r="2.4"/>`, o),
    pdf: o => S(`<path d="M6.4 3.6h7L18.4 8.6v11.8H6.4Z"/><path d="M13.2 3.6v5h5"/><path d="M9 13h1.6a1.4 1.4 0 0 1 0 2.8H9Zm0 0v5"/><path d="M14 13v5.8h1a2 2 0 0 0 0-5.8Z"/>`, o),
    doc: o => S(`<path d="M6.4 3.6h7L18.4 8.6v11.8H6.4Z"/><path d="M13.2 3.6v5h5"/><path d="M9.2 12.6h6M9.2 15.6h6M9.2 18.4h3.4"/>`, o),
    archive: o => S(`<rect x="3.4" y="4.4" width="17.2" height="4.4" rx="1.4"/><path d="M5 8.8v9.6a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6V8.8"/><path d="M10 12.6h4"/>`, o),
    gearSm: o => S(`<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>`, o),
    globe: o => S(`<circle cx="12" cy="12" r="8.8"/><path d="M3.4 12h17.2"/><ellipse cx="12" cy="12" rx="4.2" ry="8.8"/>`, o),
    paintSm: o => S(`<path d="M4.6 8.6A7.6 7.6 0 0 1 19.4 8"/> <rect x="3" y="8.4" width="18" height="5.4" rx="2"/><path d="M12 13.8v2.6a2 2 0 0 0 2 2h.6"/>`, o),
    box: o => S(`<path d="m12 3.2 8 4v9.6l-8 4-8-4V7.2Z"/><path d="m4 7.2 8 4 8-4M12 11.2V20.8"/>`, o),
    plug: o => S(`<path d="M9 3.6v5M15 3.6v5"/><path d="M6 8.6h12v3.2a6 6 0 0 1-12 0Z"/><path d="M12 17.8v3.4"/>`, o),
    dotUp: o => S(`<circle cx="12" cy="12" r="4.2" fill="#2ecc71" stroke="none"/>`, o),
    dotDown: o => S(`<circle cx="12" cy="12" r="4.2" fill="#ff5f57" stroke="none"/>`, o),
    bolt: o => S(`<path d="M13.2 2.6 5.8 13h4.6l-.8 8.4L18.2 11h-4.6l-.4-8.4Z" fill="#febc2e" stroke="none"/>`, o),
    pulse: o => S(`<path d="M2.6 12h3.6l2.2-5.4 3.4 11 2.6-7 1.8 3.4h5.2"/>`, o),
    hexa: o => S(`<path d="M12 2.6 20.2 7v10L12 21.4 3.8 17V7Z"/>`, o),
    brain: o => S(`<path d="M12 5.2a3 3 0 0 0-5.8-.9A2.9 2.9 0 0 0 3.6 8a2.9 2.9 0 0 0 .7 4.7A3 3 0 0 0 7.4 18a2.9 2.9 0 0 0 4.6.9Z"/><path d="M12 5.2a3 3 0 0 1 5.8-.9A2.9 2.9 0 0 1 20.4 8a2.9 2.9 0 0 1-.7 4.7A3 3 0 0 1 16.6 18a2.9 2.9 0 0 1-4.6.9Z"/>`, o),
  };

  function get(name, opts = {}) {
    const f = defs[name];
    return f ? f(opts) : '';
  }
  // weather: map a code to a macOS-ish symbol name
  function wxIcon(code, opts = {}) {
    const n = (code == null) ? 3 : code;
    if (n === 0) return sun(opts);
    if (n <= 2) return sunCloud(opts);
    if (n === 3) return cloudIcon(opts);
    if (n >= 45 && n <= 48) return fog(opts);
    if (n >= 51 && n <= 67) return rain(opts);
    if (n >= 71 && n <= 77) return snow(opts);
    if (n >= 80 && n <= 82) return rain(opts);
    if (n >= 85 && n <= 86) return snow(opts);
    if (n >= 95) return storm(opts);
    return cloudIcon(opts);
  }
  const cloudIcon = o => S(`<path d="M7.2 18.5h9.6a4.3 4.3 0 0 0 .5-8.55A5.8 5.8 0 0 0 6.3 10.9a3.85 3.85 0 0 0 .9 7.6Z"/>`, o);
  const sun = o => S(`<circle cx="12" cy="12" r="4.4"/>
    <path d="M12 2.6v2.2M12 19.2v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>`, o);
  const sunCloud = o => S(`<circle cx="8.4" cy="8.4" r="3.1"/>
    <path d="M8.4 3.4v1.6M3.4 8.4H5M4.9 4.9l1.1 1.1M11.9 4.9l-1.1 1.1"/>
    <path d="M9.6 17.6h8.2a3.6 3.6 0 0 0 .4-7.2 4.9 4.9 0 0 0-9.3-1 3.2 3.2 0 0 0 .7 8.2Z"/>`, o);
  const fog = o => S(`<path d="M7.4 12.4h9a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1 3 3 0 0 0-.6 7.8Z"/>
    <path d="M5 15.6h14M7 18.8h10"/>`, o);
  const rain = o => S(`<path d="M7.4 11.8h9a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1 3 3 0 0 0-.6 7.8Z"/>
    <path d="M9 15.4l-.9 2.6M13 15.4l-.9 2.6M17 15.4l-.9 2.6"/>`, o);
  const snow = o => S(`<path d="M7.4 11.4h9a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1 3 3 0 0 0-.6 7.8Z"/>
    <path d="M9 15.6h.01M13 15.6h.01M11 18.4h.01M15 18.4h.01M7 18.4h.01"/>`, { ...o, sw: 2.4 });
  const storm = o => S(`<path d="M7.4 11.4h9a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1 3 3 0 0 0-.6 7.8Z"/>
    <path d="M12.6 13.6 9.8 17.4h3l-.8 3.2 3.2-4.2h-3l.8-2.8Z" fill="currentColor" stroke="none"/>`, o);

  return { get, wxIcon, sun, cloud: cloudIcon };
})();