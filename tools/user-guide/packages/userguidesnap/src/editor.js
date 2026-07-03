/* =====================================================================
   QSortby Guide Studio — editor (dependency-free, extension-ready).
   Data model is Remotion-friendly: a guide => ordered slides => each
   slide has a caption + an ordered list of elements (screenshot frames
   and annotation components) in logical 1280x800 coordinates.
   ===================================================================== */
(() => {
  const STAGE_W = 1280, STAGE_H = 800;
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);

  // ---- state -------------------------------------------------------
  const blank = () => ({
    id: uid('s_'),
    caption: false,   // header (eyebrow + title + sub + step chip) is opt-in, default off
    eyebrow: 'Getting started',
    head: 'Step heading goes <span class="pf">here</span>',
    sub: 'One concise sentence describing what the user does on this screen.',
    els: [],
  });

  let store = loadStore();
  if (!store) { const g0 = newProject('Untitled guide'); store = { activeId: g0.id, projects: { [g0.id]: g0 } }; }
  let guide = store.projects[store.activeId] || Object.values(store.projects)[0];
  store.activeId = guide.id;
  if (!guide.activeId) guide.activeId = guide.slides[0].id;
  let captureTarget = 'new';   // where new snaps/uploads go: 'new' | 'current' | <slideId>
  let selId = null;
  let cropId = null;   // id of the frame currently in crop-&-zoom mode
  let history = [], hidx = -1;

  // ---- dom refs ----------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), ground = $('#ground'), canvas = $('#canvas');
  const scaler = $('#scaler'), wrap = $('#stageWrap');
  const slidesEl = $('#slides'), props = $('#props'), propsTitle = $('#propsTitle');
  let scale = 1;

  const activeSlide = () => guide.slides.find((s) => s.id === guide.activeId);

  // ---- persistence (multi-project store) ---------------------------
  function newProject(title) {
    const g = { id: uid('p_'), title: title || 'Untitled guide', bg: 'light', activeId: null, slides: [blank()], updatedAt: 0 };
    g.activeId = g.slides[0].id; return g;
  }
  function loadStore() {
    try { const s = JSON.parse(localStorage.getItem('ugs_store')); if (s && s.projects && Object.keys(s.projects).length) return s; } catch (e) {}
    // migrate a legacy single guide (also lets render.mjs keep seeding 'ugs_guide')
    try { const old = JSON.parse(localStorage.getItem('ugs_guide')); if (old && old.slides) { old.id = old.id || uid('p_'); return { activeId: old.id, projects: { [old.id]: old } }; } } catch (e) {}
    return null;
  }
  function saveStore() { try { localStorage.setItem('ugs_store', JSON.stringify(store)); } catch (e) {} }
  function save() { guide.updatedAt = Date.now(); store.projects[guide.id] = guide; store.activeId = guide.id; saveStore(); }
  function snapshot() {
    history = history.slice(0, hidx + 1);
    history.push(JSON.stringify(guide));
    if (history.length > 60) history.shift();
    hidx = history.length - 1;
    save();
  }
  function undo() {
    if (hidx <= 0) return;
    hidx--; guide = JSON.parse(history[hidx]); store.projects[guide.id] = guide; selId = null; renderAll(); save();
  }
  function redo() {
    if (hidx >= history.length - 1) return;
    hidx++; guide = JSON.parse(history[hidx]); store.projects[guide.id] = guide; selId = null; renderAll(); save();
  }

  // ---- global step numbering (continuous across slides) -----------
  // a "step carrier" is a standalone badge OR a callout with its step number on
  function carriesStep(el) { return !el.hidden && (el.type === 'badge' || (el.type === 'callout' && el.step)); }
  function stepNumber(elId) {
    let n = 0;
    for (const s of guide.slides) for (const el of s.els) { if (carriesStep(el)) { n++; if (el.id === elId) return n; } }
    return n;
  }
  function stepCount() { let n = 0; for (const s of guide.slides) for (const el of s.els) if (carriesStep(el)) n++; return n; }

  // ---- element factory --------------------------------------------
  function addEl(type, opts = {}) {
    const s = activeSlide();
    const cx = 480, cy = 240; // drop near center-ish of canvas area
    const base = { id: uid('e_'), type, x: cx, y: cy, ...opts };
    const defaults = {
      badge: { x: cx, y: cy },
      arrow: { w: 150, h: 60, rot: 0 },
      highlight: { w: 260, h: 120 },
      callout: { w: 288, text: 'Click here to continue', kicker: 'Tip', accent: false, size: 'm', liquid: 28, step: true },
      pill: { text: 'New', green: true },
      blur: { w: 180, h: 44 },
      magnifier: { w: 168, h: 168, mag: 2, shape: 'circle' },
      anchor: { w: 30, h: 30 },
      frame: { w: 760, h: 460, src: opts.src || '', chrome: opts.chrome || 'none', url: opts.url || '', zoom: 1, panX: 0, panY: 0, natW: 0, natH: 0 },
    };
    Object.assign(base, defaults[type] || {});
    if (opts.w) base.w = opts.w; if (opts.h) base.h = opts.h;
    s.els.push(base);
    selId = base.id;
    snapshot(); renderAll();
  }

  // insert a screenshot sized to fit and centered in the canvas area
  function addFrameCentered(src, url) {
    const s = activeSlide();
    const img = new Image();
    img.onload = () => {
      const cw = canvas.clientWidth || 1100, ch = canvas.clientHeight || 560;
      const nw = img.naturalWidth || 16, nh = img.naturalHeight || 10;
      const chromeH = 0;                                    // default frame has no chrome
      const fit = Math.min((cw * 0.94) / nw, (ch * 0.92 - chromeH) / nh);
      const w = Math.round(nw * fit);
      const h = Math.round(nh * fit) + chromeH;
      const pretty = (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const el = { id: uid('e_'), type: 'frame', x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2),
        w, h, src, chrome: 'none', url: pretty, zoom: 1, panX: 0, panY: 0, natW: nw, natH: nh };
      s.els.push(el); selId = el.id; cropId = null;
      snapshot(); renderAll();
    };
    img.onerror = () => addEl('frame', { src, chrome: 'browser', url });
    img.src = src;
  }

  // route a snap/upload to the chosen destination slide, then center it
  function captureInto(src, url) {
    if (captureTarget === 'new') {
      // reuse the current slide if it's empty (e.g. a fresh guide), else append a new one
      if (activeSlide().els.length) { const s = blank(); guide.slides.push(s); guide.activeId = s.id; }
    } else if (captureTarget !== 'current' && guide.slides.some((s) => s.id === captureTarget)) {
      guide.activeId = captureTarget;
    }
    selId = null; renderAll();
    addFrameCentered(src, url);
  }

  // ---- rendering ---------------------------------------------------
  function renderGround() {
    ground.className = 'ground ' + (guide.bg === 'dark' ? 'ground-dark' : 'ground-light');
    document.querySelectorAll('[data-bind], .step-chip').forEach((n) => {});
    const dark = guide.bg === 'dark';
    $('#capBlock').querySelectorAll('.head').forEach((n) => n.classList.toggle('on-dark', dark));
    $('#capBlock').querySelector('.sub').classList.toggle('on-dark-mut', dark);
    $('#capBlock').querySelector('.eye').classList.toggle('on-dark', dark);
    $('#capBlock').querySelector('.step-chip').classList.toggle('on-dark', dark);
  }

  function renderCaption() {
    const s = activeSlide();
    const on = !!s.caption;
    $('#capBlock').style.display = on ? '' : 'none';
    $('#addHeaderBtn').style.display = on ? 'none' : '';
    if (!on) return;
    const set = (sel, val) => { const n = $(sel); if (document.activeElement !== n) n.innerHTML = val; };
    set('[data-bind="eyebrow"]', s.eyebrow);
    set('[data-bind="head"]', s.head);
    set('[data-bind="sub"]', s.sub);
    const idx = guide.slides.indexOf(s) + 1;
    $('#stepNum').textContent = String(idx).padStart(2, '0');
    $('#stepTotal').textContent = String(guide.slides.length).padStart(2, '0');
  }

  function elInner(el) {
    if (el.type === 'frame') {
      let chrome = '';
      if (el.chrome === 'browser') chrome = `<div class="chrome"><i></i><i></i><i></i><span class="url">🔒 ${escapeHtml(el.url || '')}</span></div>`;
      else if (el.chrome === 'app') chrome = `<div class="chrome"><i></i><i></i><i></i></div>`;
      const img = el.src ? `<img class="shot-crop" src="${el.src}" draggable="false">` :
        `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-family:var(--mono);font-size:13px">screenshot</div>`;
      const hint = cropId === el.id ? `<div class="crop-hint">drag to pan · scroll to zoom · Esc to finish</div>` : '';
      return `<div class="shot ${el.chrome === 'none' ? 'plain' : ''} ground-shadow" style="width:100%;height:100%">${chrome}<div class="shot-body">${img}${hint}</div></div>`;
    }
    if (el.type === 'badge') {
      return `<div class="cmp-badge"><span>${stepNumber(el.id)}</span></div>`;
    }
    if (el.type === 'arrow') {
      const w = el.w, h = el.h;
      return `<svg class="cmp-arrow" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <line x1="8" y1="${h/2}" x2="${w-16}" y2="${h/2}"></line>
        <polygon class="head" points="${w-22},${h/2-12} ${w},${h/2} ${w-22},${h/2+12}"></polygon></svg>`;
    }
    if (el.type === 'highlight') return `<div class="cmp-highlight" style="width:100%;height:100%"></div>`;
    if (el.type === 'callout') {
      const dark = guide.bg === 'dark';
      const cls = `cmp-callout sz-${el.size || 'm'}${el.accent ? ' accent' : ''}${dark ? ' on-dark' : ''}`;
      const stepBadge = el.step ? `<div class="cmp-badge cmp-callout-step"><span>${stepNumber(el.id)}</span></div>` : '';
      const toggle = `<button class="cstep-toggle" data-steptoggle title="${el.step ? 'Remove step number' : 'Add step number'}">${el.step ? '− step' : '＋ step'}</button>`;
      return `${stepBadge}<div class="${cls}">${el.kicker ? `<span class="ck">${escapeHtml(el.kicker)}</span>` : ''}<span class="ctext" contenteditable>${el.text}</span></div>${toggle}`;
    }
    if (el.type === 'pill') return `<span class="cmp-pill ${el.green ? 'green' : ''}">${el.text}</span>`;
    if (el.type === 'blur') return `<div class="cmp-blur" style="width:100%;height:100%"></div>`;
    if (el.type === 'magnifier') return `<div class="cmp-mag ${el.shape === 'rect' ? 'rect' : ''}"><div class="mag-lens"></div><div class="mag-empty" style="display:none">drag over a screenshot</div></div>`;
    if (el.type === 'anchor') return `<div class="cmp-anchor"></div>`;
    if (el.type === 'connector') return `<div class="cmp-connector"><svg xmlns="http://www.w3.org/2000/svg"><path class="hit"></path><path class="line"></path><polygon class="cap start" style="display:none"></polygon><polygon class="cap end"></polygon><circle class="dot" style="display:none"></circle></svg><div class="conn-end" data-end="from"></div><div class="conn-end" data-end="to"></div></div>`;
    return '';
  }

  function renderEls() {
    canvas.innerHTML = '';
    const s = activeSlide();
    s.els.forEach((el) => {
      if (el.hidden) return;   // hidden layers aren't drawn (still listed in the Layers panel)
      const node = document.createElement('div');
      node.className = 'el' + (el.id === selId ? ' selected' : '') + (el.id === cropId ? ' cropping' : '') + (el.type === 'connector' ? ' connector' : '');
      node.dataset.id = el.id;
      if (el.type === 'connector') { node.style.cssText = 'left:0;top:0;width:100%;height:100%'; node.innerHTML = elInner(el); canvas.appendChild(node); return; }
      node.style.left = el.x + 'px';
      node.style.top = el.y + 'px';
      const sized = ['frame', 'arrow', 'highlight', 'blur', 'magnifier', 'anchor'].includes(el.type);
      if (sized) { node.style.width = el.w + 'px'; node.style.height = el.h + 'px'; }
      if (el.type === 'callout') node.style.width = el.w + 'px';
      if (el.rot) node.style.transform = `rotate(${el.rot}deg)`;
      node.innerHTML = elInner(el);
      // handles
      if (sized) node.insertAdjacentHTML('beforeend', '<div class="handle se" data-h="se"></div>');
      if (el.type === 'arrow') node.insertAdjacentHTML('beforeend', '<div class="handle rot" data-h="rot"></div>');
      if (el.type === 'callout') node.insertAdjacentHTML('beforeend', '<div class="handle se" data-h="se-w"></div>');
      if (['callout', 'badge', 'highlight'].includes(el.type)) node.insertAdjacentHTML('beforeend', '<div class="link-handle" data-link title="Drag to connect to a button/area">⤳</div>');
      canvas.appendChild(node);
      // inline text editing for callout
      const ct = node.querySelector('.ctext');
      if (ct) ct.addEventListener('input', () => { el.text = ct.innerHTML; save(); });
    });
    applyCropAll();
    applyMagnifiers();
    applyConnectors();
    applyLiquid();
  }

  // ---- Liquid Glass: per-callout SVG displacement filter (adjustable warp) ----
  const SVGNS = 'http://www.w3.org/2000/svg';
  function ensureLiquidFilter(id, scale) {
    const defs = document.querySelector('.ugs-defs');
    let f = document.getElementById('ugs-liq-' + id);
    if (!f) {
      f = document.createElementNS(SVGNS, 'filter');
      f.id = 'ugs-liq-' + id;
      f.setAttribute('x', '-25%'); f.setAttribute('y', '-25%'); f.setAttribute('width', '150%'); f.setAttribute('height', '150%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      const t = document.createElementNS(SVGNS, 'feTurbulence');
      t.setAttribute('type', 'fractalNoise'); t.setAttribute('baseFrequency', '0.007 0.011'); t.setAttribute('numOctaves', '3'); t.setAttribute('seed', '7'); t.setAttribute('result', 'n');
      const g = document.createElementNS(SVGNS, 'feGaussianBlur'); g.setAttribute('in', 'n'); g.setAttribute('stdDeviation', '1.8'); g.setAttribute('result', 'nb');
      const d = document.createElementNS(SVGNS, 'feDisplacementMap'); d.setAttribute('in', 'SourceGraphic'); d.setAttribute('in2', 'nb'); d.setAttribute('xChannelSelector', 'R'); d.setAttribute('yChannelSelector', 'G');
      f.append(t, g, d); defs.append(f);
    }
    f.querySelector('feDisplacementMap').setAttribute('scale', scale);
  }
  function applyLiquid() {
    const base = 'blur(3px) saturate(180%) brightness(1.03)';
    activeSlide().els.forEach((el) => {
      if (el.type !== 'callout') return;
      const node = canvas.querySelector(`[data-id="${el.id}"] .cmp-callout`); if (!node) return;
      const lvl = el.liquid == null ? 115 : el.liquid;
      let bf = base;
      if (lvl > 0) { ensureLiquidFilter(el.id, lvl); bf = `${base} url(#ugs-liq-${el.id})`; }
      node.style.backdropFilter = bf; node.style.webkitBackdropFilter = bf;
    });
  }

  // ---- magnifier: render the screenshot area under the lens, enlarged ----
  function applyMagnifier(node, el) {
    const lens = node.querySelector('.mag-lens'); const empty = node.querySelector('.mag-empty');
    if (!lens) return;
    const cr = canvas.getBoundingClientRect();
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;        // lens center, logical canvas coords
    const frames = activeSlide().els.filter((e) => e.type === 'frame' && e.src && !e.hidden);
    let hit = null;
    for (let i = frames.length - 1; i >= 0; i--) {            // topmost frame first
      const fn = canvas.querySelector(`[data-id="${frames[i].id}"]`);
      const img = fn && fn.querySelector('img.shot-crop');
      const body = fn && fn.querySelector('.shot-body');
      if (!img || !body) continue;
      const br = body.getBoundingClientRect();
      const bx = (br.left - cr.left) / scale, by = (br.top - cr.top) / scale, bw = br.width / scale, bh = br.height / scale;
      if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) { hit = { f: frames[i], img }; break; }
    }
    if (!hit) { lens.style.backgroundImage = 'none'; if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';
    const ir = hit.img.getBoundingClientRect();
    const imgL = (ir.left - cr.left) / scale, imgT = (ir.top - cr.top) / scale;
    const iw = ir.width / scale, ih = ir.height / scale;
    const M = el.mag || 2, mw = iw * M, mh = ih * M;
    const fx = (cx - imgL) / iw, fy = (cy - imgT) / ih;       // fraction of the displayed image under the lens center
    lens.style.backgroundImage = `url("${hit.f.src}")`;
    lens.style.backgroundSize = `${mw}px ${mh}px`;
    lens.style.backgroundPosition = `${el.w / 2 - fx * mw}px ${el.h / 2 - fy * mh}px`;
  }
  function applyMagnifiers() {
    canvas.querySelectorAll('.el').forEach((node) => {
      const el = activeSlide().els.find((x) => x.id === node.dataset.id);
      if (el && el.type === 'magnifier') applyMagnifier(node, el);
    });
  }

  // ---- connectors: anchored, auto-routing bezier arrows ------------
  function elRectLogical(id) {
    const node = canvas.querySelector(`[data-id="${id}"]`); if (!node) return null;
    // prefer the callout body over its attached step badge (which renders first in the DOM)
    const inner = node.querySelector('.cmp-callout') || node.querySelector('.cmp-anchor') || node.querySelector('.cmp-highlight') || node.querySelector('.cmp-badge') || node;
    const cr = canvas.getBoundingClientRect(), r = inner.getBoundingClientRect();
    return { x: (r.left - cr.left) / scale, y: (r.top - cr.top) / scale, w: r.width / scale, h: r.height / scale };
  }
  function centerOf(ep) {
    if (ep.point) return ep.point;
    const r = elRectLogical(ep.ref); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
  }
  function edgePoint(r, toward) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2; const dx = toward.x - cx, dy = toward.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const t = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
    return { x: cx + dx * t, y: cy + dy * t };
  }
  function attachOf(ep, towardCenter) {
    if (ep.point) return ep.point;
    const el = activeSlide().els.find((x) => x.id === ep.ref); const r = elRectLogical(ep.ref);
    if (!r) return null;
    if (el && el.type === 'anchor') return { x: r.x + r.w / 2, y: r.y + r.h / 2 };  // point AT the spot
    return edgePoint(r, towardCenter);                                              // flush to the edge
  }
  function arrowHead(tip, ang, size) {
    const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
    return `${tip.x},${tip.y} ${tip.x + Math.cos(a1) * size},${tip.y + Math.sin(a1) * size} ${tip.x + Math.cos(a2) * size},${tip.y + Math.sin(a2) * size}`;
  }
  // describe an endpoint: a box (callout/highlight/badge) vs a point/anchor target
  function endpointInfo(ep) {
    if (ep.point) return { point: ep.point, center: ep.point, isBox: false };
    const el = activeSlide().els.find((x) => x.id === ep.ref); const r = elRectLogical(ep.ref);
    if (!r) return null;
    return { rect: r, center: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, isBox: !!el && el.type !== 'anchor' };
  }
  // outward unit normal of the box edge that faces `toward`
  // pick the side facing the target by DOMINANT direction (more-horizontal → left/right, else top/bottom)
  function sideNormal(r, toward) {
    const dx = toward.x - (r.x + r.w / 2), dy = toward.y - (r.y + r.h / 2);
    return Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
  }
  // snap to the MIDPOINT of the chosen side (+ gap) — clean, predictable attachment
  function sideAttach(r, n, gap) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return n.x !== 0 ? { x: cx + n.x * (r.w / 2 + gap), y: cy } : { x: cx, y: cy + n.y * (r.h / 2 + gap) };
  }
  const vunit = (x, y) => { const m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m }; };
  const axisSnap = (x, y) => (Math.abs(x) >= Math.abs(y) ? { x: Math.sign(x) || 1, y: 0 } : { x: 0, y: Math.sign(y) || 1 });
  // polyline → path with rounded corners (the "curving rectangular" look)
  function roundedPath(raw, r) {
    const P = []; for (const p of raw) { const q = P[P.length - 1]; if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 0.5) P.push(p); }
    if (P.length < 2) return '';
    let d = `M ${P[0].x} ${P[0].y}`;
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y) || 1, l2 = Math.hypot(c.x - b.x, c.y - b.y) || 1, rr = Math.min(r, l1 / 2, l2 / 2);
      const p1 = { x: b.x + (a.x - b.x) / l1 * rr, y: b.y + (a.y - b.y) / l1 * rr };
      const p2 = { x: b.x + (c.x - b.x) / l2 * rr, y: b.y + (c.y - b.y) / l2 * rr };
      d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
    }
    const L = P[P.length - 1]; return d + ` L ${L.x} ${L.y}`;
  }
  function applyConnector(node, c) {
    const svg = node.querySelector('svg'); const line = node.querySelector('path.line'); const hit = node.querySelector('path.hit');
    const capS = node.querySelector('polygon.start'); const capE = node.querySelector('polygon.end'); const dot = node.querySelector('circle.dot');
    const w = canvas.clientWidth, h = canvas.clientHeight; svg.setAttribute('width', w); svg.setAttribute('height', h);
    const A = endpointInfo(c.from), B = endpointInfo(c.to);
    if (!A || !B) { line.setAttribute('d', ''); hit.setAttribute('d', ''); capS.style.display = 'none'; capE.style.display = 'none'; return; }
    const gap = 9, dist = Math.hypot(B.center.x - A.center.x, B.center.y - A.center.y) || 1, route = c.route || 'elbow';
    // SOURCE attach (perpendicular exit so the line never crosses the box)
    let P0, sDir;
    if (A.isBox) { sDir = sideNormal(A.rect, B.center); P0 = sideAttach(A.rect, sDir, gap); }
    else { P0 = A.point || A.center; }
    // TARGET attach
    let P3, tDirBox = null;
    if (B.isBox) { tDirBox = sideNormal(B.rect, A.center); P3 = sideAttach(B.rect, tDirBox, gap); }
    else { P3 = B.point || B.center; }
    // arrowhead size + caps up front, so the line can stop at the head's BASE
    // (otherwise the rounded stroke pokes out past the triangle's point).
    const hs = (c.thickness || 5) * 2.2 + 4, caps = c.caps || 'end';
    const endTrim = (caps === 'end' || caps === 'both') ? hs * 0.82 : 0;
    // pull a point back from `to` toward `from` by `t` px (clamped to the segment)
    const pullBack = (from, to, t) => { const m = Math.hypot(to.x - from.x, to.y - from.y) || 1, k = Math.min(t, m * 0.9) / m; return { x: to.x - (to.x - from.x) * k, y: to.y - (to.y - from.y) * k }; };
    let dLine, dHit, endAng, startAng;
    if (route === 'elbow') {
      // Single clean right-angle: leave the source on the side that faces the
      // target, run straight, make ONE 90° turn, and arrive perpendicular at
      // the target. The corner sits at the intersection of those two runs.
      if (!A.isBox) sDir = axisSnap(B.center.x - P0.x, B.center.y - P0.y);
      const horizExit = sDir.x !== 0;
      // For a box target, attach on the edge perpendicular to the arriving
      // segment so the lone corner stays clean (no grazing the box).
      if (B.isBox) {
        const tN = horizExit
          ? { x: 0, y: Math.sign(P0.y - B.center.y) || 1 }
          : { x: Math.sign(P0.x - B.center.x) || 1, y: 0 };
        P3 = sideAttach(B.rect, tN, gap);
      }
      const corner = horizExit ? { x: P3.x, y: P0.y } : { x: P0.x, y: P3.y };
      endAng = Math.atan2(P3.y - corner.y, P3.x - corner.x);
      startAng = Math.atan2(P0.y - corner.y, P0.x - corner.x);
      dLine = roundedPath([P0, corner, endTrim ? pullBack(corner, P3, endTrim) : P3], 14);
      dHit = roundedPath([P0, corner, P3], 14);
    } else {
      if (!A.isBox) sDir = vunit(B.center.x - P0.x, B.center.y - P0.y);
      const tDir = B.isBox ? tDirBox : vunit(P0.x - P3.x, P0.y - P3.y);
      const stem = Math.max(34, Math.min(230, dist * (0.26 + (c.curve || 0))));
      const P1 = { x: P0.x + sDir.x * stem, y: P0.y + sDir.y * stem };
      const P2 = { x: P3.x + tDir.x * stem * (B.isBox ? 1 : 0.85), y: P3.y + tDir.y * stem * (B.isBox ? 1 : 0.85) };
      endAng = Math.atan2(P3.y - P2.y, P3.x - P2.x); startAng = Math.atan2(P0.y - P1.y, P0.x - P1.x);
      const Pe = endTrim ? { x: P3.x - Math.cos(endAng) * endTrim, y: P3.y - Math.sin(endAng) * endTrim } : P3;
      dLine = `M ${P0.x} ${P0.y} C ${P1.x} ${P1.y} ${P2.x} ${P2.y} ${Pe.x} ${Pe.y}`;
      dHit = `M ${P0.x} ${P0.y} C ${P1.x} ${P1.y} ${P2.x} ${P2.y} ${P3.x} ${P3.y}`;
    }
    line.setAttribute('d', dLine); hit.setAttribute('d', dHit);
    line.setAttribute('stroke-width', c.thickness || 5);
    line.style.strokeDasharray = c.dashed ? `${(c.thickness || 5) * 2} ${(c.thickness || 5) * 1.7}` : 'none';
    if (caps === 'end' || caps === 'both') { capE.setAttribute('points', arrowHead(P3, endAng, hs)); capE.style.display = ''; } else capE.style.display = 'none';
    if (caps === 'start' || caps === 'both') { capS.setAttribute('points', arrowHead(P0, startAng, hs)); capS.style.display = ''; } else capS.style.display = 'none';
    // source node: a small dot marks where the connector originates (unless the start itself is an arrowhead)
    if (dot) {
      if (caps === 'start' || caps === 'both') dot.style.display = 'none';
      else { dot.setAttribute('cx', P0.x); dot.setAttribute('cy', P0.y); dot.setAttribute('r', (c.thickness || 5) + 3); dot.style.display = ''; }
    }
    const hf = node.querySelector('.conn-end[data-end="from"]'); const ht = node.querySelector('.conn-end[data-end="to"]');
    if (hf) { hf.style.left = P0.x + 'px'; hf.style.top = P0.y + 'px'; }
    if (ht) { ht.style.left = P3.x + 'px'; ht.style.top = P3.y + 'px'; }
  }
  function applyConnectors() {
    activeSlide().els.forEach((c) => { if (c.type !== 'connector') return; const node = canvas.querySelector(`[data-id="${c.id}"]`); if (node) applyConnector(node, c); });
  }
  // create a connector from the selected/last callout to a fresh anchor beside it
  function addConnector() {
    const s = activeSlide();
    // FROM = the selected callout, else the most recently added callout (arrow comes OUT of the callout)
    const callouts = s.els.filter((e) => e.type === 'callout');
    const src = (selId && s.els.find((x) => x.id === selId && x.type === 'callout')) || callouts[callouts.length - 1];
    if (!src) { toast('Add a callout first, then a connector — or drag the ⤳ handle on one'); return; }
    // TO = the most recently added target (anchor/highlight/badge); otherwise drop a fresh anchor beside it
    const targets = s.els.filter((e) => ['anchor', 'highlight', 'badge'].includes(e.type) && e.id !== src.id);
    let toRef;
    if (targets.length) toRef = targets[targets.length - 1].id;
    else { const A = { id: uid('e_'), type: 'anchor', x: Math.round(src.x + (src.w || 280) + 80), y: Math.round(src.y + 24), w: 30, h: 30 }; s.els.push(A); toRef = A.id; }
    const C = { id: uid('e_'), type: 'connector', from: { ref: src.id }, to: { ref: toRef }, caps: 'end', route: 'elbow', curve: 0.18, thickness: 5, dashed: false };
    s.els.push(C); selId = C.id; snapshot(); renderAll();
    toast(targets.length ? 'Linked the latest callout → latest target' : 'Drag the dashed target dot onto the button/area to point at');
  }
  // remove connectors whose endpoints vanished, and anchors no connector uses
  function pruneConnectors() {
    const s = activeSlide(); const ids = new Set(s.els.map((e) => e.id));
    s.els = s.els.filter((e) => e.type !== 'connector' || ((e.from.point || ids.has(e.from.ref)) && (e.to.point || ids.has(e.to.ref))));
    const refed = new Set(); s.els.forEach((e) => { if (e.type === 'connector') { if (e.from.ref) refed.add(e.from.ref); if (e.to.ref) refed.add(e.to.ref); } });
    s.els = s.els.filter((e) => e.type !== 'anchor' || refed.has(e.id));
  }

  // position a frame's image as a pan/zoomable cover inside its viewport box
  function applyCrop(node, el) {
    const img = node.querySelector('img.shot-crop');
    const body = node.querySelector('.shot-body');
    if (!img || !body) return;
    const bw = body.clientWidth, bh = body.clientHeight;
    if (!bw || !bh) return;
    let nw = el.natW || img.naturalWidth, nh = el.natH || img.naturalHeight;
    if (!nw || !nh) { img.onload = () => { el.natW = img.naturalWidth; el.natH = img.naturalHeight; applyCrop(node, el); applyMagnifiers(); save(); }; return; }
    if (!el.natW) { el.natW = nw; el.natH = nh; }
    const s = Math.max(bw / nw, bh / nh) * (el.zoom || 1);   // cover, then zoom
    const rw = nw * s, rh = nh * s;
    const maxX = (rw - bw) / 2, maxY = (rh - bh) / 2;         // clamp so image always covers
    el.panX = Math.max(-maxX, Math.min(maxX, el.panX || 0));
    el.panY = Math.max(-maxY, Math.min(maxY, el.panY || 0));
    img.style.width = rw + 'px'; img.style.height = rh + 'px';
    img.style.left = ((bw - rw) / 2 + el.panX) + 'px';
    img.style.top = ((bh - rh) / 2 + el.panY) + 'px';
  }
  function applyCropAll() {
    canvas.querySelectorAll('.el').forEach((node) => {
      const el = activeSlide().els.find((x) => x.id === node.dataset.id);
      if (el && el.type === 'frame') applyCrop(node, el);
    });
  }

  function renderSlides() {
    slidesEl.innerHTML = '';
    $('#slideCount').textContent = guide.slides.length;
    guide.slides.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'slide-card' + (s.id === guide.activeId ? ' active' : '');
      const frame = s.els.find((e) => e.type === 'frame' && e.src);
      const badges = s.els.filter((e) => e.type === 'badge').length;
      const ann = s.els.filter((e) => e.type !== 'frame').length;
      card.innerHTML = `
        <div class="thumb ${guide.bg === 'dark' ? 'ground-dark' : 'ground-light'}" style="position:relative">
          ${frame ? `<img src="${frame.src}" style="position:absolute;inset:14% 12%;width:76%;height:auto;border-radius:4px;box-shadow:0 6px 14px -6px rgba(0,0,0,.4)">` : ''}
        </div>
        <div class="cap"><span><span class="num">${String(i + 1).padStart(2, '0')}</span> &nbsp;${escapeHtml(stripHtml(s.head)).slice(0, 22) || 'Slide'}</span><span class="kbd">${ann}●</span></div>
        <div class="row-acts">
          <button class="icon-btn" data-act="dup" title="Duplicate">⧉</button>
          <button class="icon-btn" data-act="up" title="Move up">↑</button>
          <button class="icon-btn" data-act="del" title="Delete">✕</button>
        </div>`;
      card.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'dup') return dupSlide(i);
        if (act === 'up') return moveSlide(i, -1);
        if (act === 'del') return delSlide(i);
        guide.activeId = s.id; selId = null; renderAll(); save();
      });
      slidesEl.appendChild(card);
    });
  }

  function renderProps() {
    updateEditBar();
    const s = activeSlide();
    const el = s.els.find((e) => e.id === selId);
    if (!el) {
      propsTitle.textContent = 'Properties';
      props.innerHTML = `<p class="empty-hint">Select an element to edit it. Steps auto-number across all slides (${stepCount()} total). <span class="kbd">⌫</span> deletes · <span class="kbd">⌘Z</span> undo.</p>`;
      return;
    }
    const label = { frame: 'Screenshot', badge: 'Step badge', arrow: 'Free arrow', highlight: 'Highlight', callout: 'Callout', pill: 'Pill label', blur: 'Blur patch', magnifier: 'Magnifier', connector: 'Connector', anchor: 'Anchor target' }[el.type];
    propsTitle.textContent = label;
    let html = '';
    if (el.type === 'frame') {
      html += seg('Frame chrome', ['browser', 'app', 'none'], el.chrome, 'chrome');
      if (el.chrome === 'browser') html += textProp('URL bar', el.url, 'url');
      html += `<div class="prop"><label>Zoom (${(el.zoom || 1).toFixed(2)}×)</label><input type="range" min="1" max="5" step="0.05" value="${el.zoom || 1}" data-prop="zoom"></div>`;
      html += `<div class="prop"><div class="seg">
        <button data-crop="toggle" class="${cropId === el.id ? 'on' : ''}">${cropId === el.id ? '✓ Cropping' : '✥ Crop & zoom'}</button>
        <button data-crop="reset">Reset</button></div>
        <p class="empty-hint" style="margin-top:7px">${cropId === el.id ? 'Drag the image to pan, scroll to zoom. Drag the corner handle to change the crop window.' : 'Or double-click the screenshot to crop.'}</p></div>`;
    }
    if (el.type === 'badge') html += `<p class="empty-hint">Step <b>#${stepNumber(el.id)}</b>, numbered automatically across the whole guide (badges + callout steps). Reorder to renumber.</p>`;
    if (el.type === 'arrow') html += rangeProp('Rotation', el.rot || 0, -180, 180, 'rot');
    if (el.type === 'connector') {
      html += `<div class="prop"><label>Routing</label><div class="seg">${[['elbow', 'Rectangular'], ['curved', 'Curved']].map(([v, l]) => `<button data-seg="route" data-val="${v}" class="${(el.route || 'elbow') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
      html += `<div class="prop"><label>Arrowheads</label><div class="seg">${[['end', '→'], ['start', '←'], ['both', '↔'], ['none', '—']].map(([v, l]) => `<button data-seg="caps" data-val="${v}" class="${(el.caps || 'end') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
      html += `<div class="prop"><label>Curve (${Math.round((el.curve || 0) * 100)})</label><input type="range" min="0" max="0.5" step="0.02" value="${el.curve || 0}" data-prop="curve"></div>`;
      html += `<div class="prop"><label>Thickness (${el.thickness || 5})</label><input type="range" min="2" max="14" step="1" value="${el.thickness || 5}" data-prop="thickness"></div>`;
      html += toggleProp('Dashed', el.dashed, 'dashed');
    }
    if (el.type === 'anchor') html += `<p class="empty-hint">Invisible target — drag it onto the button/area a connector should point at. It never appears in exports.</p>`;
    if (el.type === 'callout') {
      html += textareaProp('Text', el.text, 'text');
      html += textProp('Kicker (optional)', el.kicker, 'kicker');
      html += `<div class="prop"><label>Text size</label><div class="seg">${['s', 'm', 'l'].map((v) => `<button data-seg="size" data-val="${v}" class="${(el.size || 'm') === v ? 'on' : ''}">${({ s: 'Small', m: 'Medium', l: 'Large' })[v]}</button>`).join('')}</div></div>`;
      html += `<div class="prop"><label>Liquid warp (${el.liquid == null ? 28 : el.liquid})</label><input type="range" min="0" max="64" step="2" value="${el.liquid == null ? 28 : el.liquid}" data-prop="liquid"></div>`;
      html += `<div class="prop"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12.5px;color:var(--ink-2)"><input type="checkbox" data-stepchk ${el.step ? 'checked' : ''}> Attach step number ${el.step ? '(#' + stepNumber(el.id) + ')' : ''}</label></div>`;
      html += toggleProp('Green accent', el.accent, 'accent');
    }
    if (el.type === 'pill') { html += textProp('Label', el.text, 'text'); html += toggleProp('Green', el.green, 'green'); }
    if (el.type === 'magnifier') {
      html += `<div class="prop"><label>Magnification (${(el.mag || 2).toFixed(1)}×)</label><input type="range" min="1.2" max="5" step="0.1" value="${el.mag || 2}" data-prop="mag"></div>`;
      html += seg('Shape', ['circle', 'rect'], el.shape || 'circle', 'shape');
      html += `<p class="empty-hint">Place the lens over a screenshot — it shows that area enlarged. Drag to move, corner to resize.</p>`;
    }
    html += `<button class="btn del-el" data-del="1" style="margin-top:6px">Delete element</button>`;
    props.innerHTML = html;
    // wire
    props.querySelectorAll('[data-prop]').forEach((inp) => {
      const k = inp.dataset.prop;
      inp.addEventListener('input', () => {
        el[k] = inp.type === 'checkbox' ? inp.checked : (inp.type === 'range' ? +inp.value : inp.value);
        renderEls(); save();
      });
      inp.addEventListener('change', () => snapshot());
    });
    props.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => {
      el[b.dataset.seg] = b.dataset.val; snapshot(); renderEls(); renderProps();
    }));
    props.querySelectorAll('[data-crop]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.crop === 'toggle') cropId = (cropId === el.id) ? null : el.id;
      else { el.zoom = 1; el.panX = 0; el.panY = 0; snapshot(); }
      renderAll();
    }));
    const sc = props.querySelector('[data-stepchk]');
    if (sc) sc.addEventListener('change', () => { el.step = sc.checked; snapshot(); renderAll(); });
    const del = props.querySelector('[data-del]');
    if (del) del.addEventListener('click', () => deleteSel());
  }

  // prop builders
  const textProp = (l, v, k) => `<div class="prop"><label>${l}</label><input type="text" data-prop="${k}" value="${escapeAttr(v || '')}"></div>`;
  const textareaProp = (l, v, k) => `<div class="prop"><label>${l}</label><textarea data-prop="${k}">${escapeHtml(v || '')}</textarea></div>`;
  const rangeProp = (l, v, mn, mx, k) => `<div class="prop"><label>${l} (${v}°)</label><input type="range" min="${mn}" max="${mx}" value="${v}" data-prop="${k}"></div>`;
  const toggleProp = (l, v, k) => `<div class="prop"><label><input type="checkbox" data-prop="${k}" ${v ? 'checked' : ''}> ${l}</label></div>`;
  const seg = (l, opts, cur, k) => `<div class="prop"><label>${l}</label><div class="seg">${opts.map((o) => `<button data-seg="${k}" data-val="${o}" class="${o === cur ? 'on' : ''}">${o}</button>`).join('')}</div></div>`;

  // ---- layers panel (z-order = element array order; later = on top) ----
  const LAYER_ICON = { frame: '🖼️', badge: '①', arrow: '↗', highlight: '⬚', callout: '💬', pill: '🏷️', blur: '▒', magnifier: '🔍', connector: '↝', anchor: '◎' };
  function layerName(el) {
    switch (el.type) {
      case 'frame': return el.url ? 'Screenshot · ' + el.url : 'Screenshot';
      case 'badge': return 'Step ' + stepNumber(el.id);
      case 'arrow': return 'Arrow';
      case 'highlight': return 'Highlight';
      case 'callout': return 'Callout — ' + (stripHtml(el.text).slice(0, 18) || '…');
      case 'pill': return 'Pill — ' + (el.text || '');
      case 'blur': return 'Blur';
      case 'magnifier': return 'Magnifier ' + (el.mag || 2) + '×';
      case 'connector': return 'Connector';
      case 'anchor': return 'Anchor target';
    }
    return el.type;
  }
  function moveLayer(id, dir) {   // dir +1 = bring forward (toward front), -1 = send backward
    const s = activeSlide(); const i = s.els.findIndex((e) => e.id === id); if (i < 0) return;
    const j = i + dir; if (j < 0 || j >= s.els.length) return;
    const [it] = s.els.splice(i, 1); s.els.splice(j, 0, it);
    snapshot(); renderAll();
  }
  function renderLayers() {
    const wrap = $('#layers'); const s = activeSlide();
    $('#layerCount').textContent = s.els.length;
    if (!s.els.length) { wrap.innerHTML = '<p class="empty-hint">No elements yet — add a screenshot or component.</p>'; return; }
    wrap.innerHTML = '';
    [...s.els].reverse().forEach((el) => {                  // top-most first
      const row = document.createElement('div');
      row.className = 'layer-row' + (el.id === selId ? ' active' : '') + (el.hidden ? ' hidden' : '');
      row.innerHTML = `<span class="lglyph">${LAYER_ICON[el.type] || '•'}</span>
        <span class="lname">${escapeHtml(layerName(el))}</span>
        <span class="lacts">
          <button class="icon-btn" data-l="up" title="Bring forward">↑</button>
          <button class="icon-btn" data-l="down" title="Send backward">↓</button>
          <button class="icon-btn" data-l="hide" title="${el.hidden ? 'Show' : 'Hide'}">${el.hidden ? '◌' : '◉'}</button>
          <button class="icon-btn" data-l="del" title="Delete">✕</button>
        </span>`;
      row.addEventListener('click', (e) => {
        const act = e.target.closest('[data-l]')?.dataset.l;
        if (act === 'up') return moveLayer(el.id, +1);
        if (act === 'down') return moveLayer(el.id, -1);
        if (act === 'hide') { el.hidden = !el.hidden; if (el.hidden && cropId === el.id) cropId = null; snapshot(); renderAll(); return; }
        if (act === 'del') { s.els = s.els.filter((x) => x.id !== el.id); if (selId === el.id) selId = null; pruneConnectors(); snapshot(); renderAll(); return; }
        selId = el.id; if (cropId && cropId !== el.id) cropId = null; renderAll();
      });
      wrap.appendChild(row);
    });
  }

  // ---- capture destination selector ----
  function renderCapTarget() {
    const sel = $('#capTarget'); if (!sel) return;
    sel.innerHTML = ['<option value="new">＋ New slide</option>', '<option value="current">Current slide</option>']
      .concat(guide.slides.map((s, i) => `<option value="${s.id}">Slide ${String(i + 1).padStart(2, '0')}</option>`)).join('');
    sel.value = captureTarget;
    if (sel.value !== captureTarget) { captureTarget = 'new'; sel.value = 'new'; }
  }

  // ---- projects + dashboard ----
  function createProject() { const g = newProject('Untitled guide'); store.projects[g.id] = g; saveStore(); openProject(g.id); }
  function openProject(id) {
    if (!store.projects[id]) return;
    save();
    store.activeId = id; guide = store.projects[id];
    if (!guide.activeId) guide.activeId = guide.slides[0].id;
    selId = null; cropId = null; history = []; hidx = -1; captureTarget = 'new';
    $('#guideTitle').value = guide.title;
    $('#bgLight').classList.toggle('on', guide.bg !== 'dark');
    $('#bgDark').classList.toggle('on', guide.bg === 'dark');
    showEditor();
    snapshot(); renderAll(); fit();
  }
  function showDashboard() { save(); renderDashboard(); document.body.classList.add('dash-open'); }
  function showEditor() { document.body.classList.remove('dash-open'); }
  function renderDashboard() {
    const grid = $('#dashGrid'); if (!grid) return;
    const list = Object.values(store.projects).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    grid.innerHTML = '<button class="dash-card new" data-dnew><span class="plus">＋</span><span>New guide</span></button>' +
      list.map((g) => {
        const frame = g.slides.flatMap((s) => s.els).find((e) => e.type === 'frame' && e.src);
        const when = g.updatedAt ? new Date(g.updatedAt).toLocaleDateString() : 'new';
        return `<div class="dash-card ${g.id === guide.id ? 'current' : ''}" data-pid="${g.id}">
          <div class="dash-thumb ${g.bg === 'dark' ? 'ground-dark' : 'ground-light'}">${frame ? `<img src="${frame.src}">` : ''}</div>
          <div class="dash-meta"><div class="dash-title">${escapeHtml(g.title || 'Untitled')}</div>
            <div class="dash-sub">${g.slides.length} slide${g.slides.length > 1 ? 's' : ''} · ${when}</div></div>
          <div class="dash-acts">
            <button data-d="rename" title="Rename">✎</button>
            <button data-d="dup" title="Duplicate">⧉</button>
            <button data-d="del" title="Delete">✕</button></div></div>`;
      }).join('');
  }

  // show the floating "Done editing arrow" confirmation while a connector/anchor is selected
  function updateEditBar() {
    const el = activeSlide().els.find((e) => e.id === selId);
    const editing = !!el && (el.type === 'connector' || el.type === 'anchor');
    const btn = $('#editDone'); if (btn) btn.style.display = editing ? 'block' : 'none';
  }
  function finishArrowEdit() { selId = null; cropId = null; renderAll(); toast('Arrow set — pick your next tool'); }

  function renderAll() { renderGround(); renderCaption(); renderEls(); renderSlides(); renderCapTarget(); renderLayers(); renderProps(); }

  // ---- slide ops ---------------------------------------------------
  function dupSlide(i) {
    const copy = JSON.parse(JSON.stringify(guide.slides[i]));
    copy.id = uid('s_'); copy.els.forEach((e) => (e.id = uid('e_')));
    guide.slides.splice(i + 1, 0, copy); guide.activeId = copy.id; selId = null;
    snapshot(); renderAll(); toast('Slide duplicated — reuse the screenshot with new annotations');
  }
  function moveSlide(i, dir) {
    const j = i + dir; if (j < 0 || j >= guide.slides.length) return;
    const [it] = guide.slides.splice(i, 1); guide.slides.splice(j, 0, it);
    snapshot(); renderAll();
  }
  function delSlide(i) {
    if (guide.slides.length === 1) return toast('A guide needs at least one slide');
    const wasActive = guide.slides[i].id === guide.activeId;
    guide.slides.splice(i, 1);
    if (wasActive) guide.activeId = guide.slides[Math.max(0, i - 1)].id;
    selId = null; snapshot(); renderAll();
  }
  function addSlide() {
    const s = blank(); guide.slides.push(s); guide.activeId = s.id; selId = null;
    snapshot(); renderAll(); toast('Slide added — capture or upload a screenshot');
  }

  function deleteSel() {
    const s = activeSlide();
    s.els = s.els.filter((e) => e.id !== selId); selId = null;
    pruneConnectors();
    snapshot(); renderAll();
  }

  // ---- drag / resize / rotate -------------------------------------
  let drag = null;
  let lastDown = { id: null, t: 0 };   // for manual double-click detection
  canvas.addEventListener('pointerdown', (e) => {
    const elNode = e.target.closest('.el'); if (!elNode) return;
    if (e.target.closest('[data-steptoggle]')) {   // the subtle hover toggle on a callout
      const el = activeSlide().els.find((x) => x.id === elNode.dataset.id);
      el.step = !el.step; selId = el.id; snapshot(); renderAll(); e.preventDefault(); return;
    }
    if (e.target.classList.contains('conn-end')) {  // re-aim an existing connector endpoint
      selId = elNode.dataset.id;
      drag = { mode: 'endpoint', connId: elNode.dataset.id, end: e.target.dataset.end, pid: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault(); return;
    }
    if (e.target.closest('[data-link]')) {         // drag-to-connect: start a connector from this element
      const cr = canvas.getBoundingClientRect();
      const pt = { x: (e.clientX - cr.left) / scale, y: (e.clientY - cr.top) / scale };
      const conn = { id: uid('e_'), type: 'connector', from: { ref: elNode.dataset.id }, to: { point: pt }, caps: 'end', route: 'elbow', curve: 0.18, thickness: 5, dashed: false };
      activeSlide().els.push(conn); selId = conn.id;
      drag = { mode: 'link', connId: conn.id, pid: e.pointerId };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}   // capture on the stable canvas so release anywhere finalizes
      renderEls(); e.preventDefault(); return;
    }
    if (e.target.classList.contains('ctext')) { selId = elNode.dataset.id; renderEls(); renderProps(); return; }
    const id = elNode.dataset.id;
    const el = activeSlide().els.find((x) => x.id === id);
    const h = e.target.dataset.h;
    if (el.type === 'connector') { selId = id; cropId = null; renderEls(); renderProps(); e.preventDefault(); return; }
    // double-click a screenshot → enter crop & zoom (native dblclick can't fire: renderEls swaps the node between clicks)
    const now = performance.now();
    const dbl = el.type === 'frame' && cropId !== id && !h && lastDown.id === id && (now - lastDown.t) < 350;
    lastDown = { id, t: now };
    if (dbl) { selId = cropId = id; drag = null; try { elNode.releasePointerCapture(e.pointerId); } catch (_) {} renderAll(); e.preventDefault(); return; }
    if (id !== cropId) cropId = null;   // interacting with anything else exits crop mode
    selId = id;
    const isPan = el.type === 'frame' && cropId === id && e.target.classList.contains('shot-crop');
    drag = { id, mode: isPan ? 'pan' : (h || 'move'), sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w || 0, oh: el.h || 0, orot: el.rot || 0, opanX: el.panX || 0, opanY: el.panY || 0, el };
    elNode.setPointerCapture(e.pointerId);
    renderEls(); renderProps(); e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mode === 'link' || drag.mode === 'endpoint') {
      const cr = canvas.getBoundingClientRect();
      const c = activeSlide().els.find((x) => x.id === drag.connId);
      const end = drag.mode === 'link' ? 'to' : drag.end;
      c[end] = { point: { x: (e.clientX - cr.left) / scale, y: (e.clientY - cr.top) / scale } };
      applyConnectors(); return;
    }
    const dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
    const el = drag.el;
    if (drag.mode === 'pan') { el.panX = drag.opanX + dx; el.panY = drag.opanY + dy; applyCrop(canvas.querySelector(`[data-id="${drag.id}"]`), el); applyMagnifiers(); return; }
    if (drag.mode === 'move') { el.x = Math.round(drag.ox + dx); el.y = Math.round(drag.oy + dy); }
    else if (drag.mode === 'se') {
      if (el.type === 'magnifier') { const sz = Math.max(60, Math.round(drag.ow + Math.max(dx, dy))); el.w = el.h = sz; }
      else { el.w = Math.max(40, Math.round(drag.ow + dx)); el.h = Math.max(30, Math.round(drag.oh + dy)); }
    }
    else if (drag.mode === 'se-w') { el.w = Math.max(120, Math.round(drag.ow + dx)); }
    else if (drag.mode === 'rot') {
      const node = canvas.querySelector(`[data-id="${drag.id}"]`); const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      el.rot = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90);
    }
    // live update without full rerender
    const node = canvas.querySelector(`[data-id="${drag.id}"]`);
    node.style.left = el.x + 'px'; node.style.top = el.y + 'px';
    if (el.w && drag.mode !== 'move') node.style.width = el.w + 'px';
    if (el.h && drag.mode === 'se') node.style.height = el.h + 'px';
    if (drag.mode === 'rot') node.style.transform = `rotate(${el.rot}deg)`;
    if (drag.mode === 'se' && el.type === 'frame') applyCrop(node, el);
    if ((drag.mode === 'se') && el.type === 'arrow') { node.innerHTML = elInner(el) + '<div class="handle se" data-h="se"></div><div class="handle rot" data-h="rot"></div>'; }
    applyMagnifiers();    // moving a magnifier (or a frame under one) updates the lens live
    applyConnectors();    // moving a callout/anchor re-routes its connectors live
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!drag) return;
    if (drag.mode === 'link') { finalizeEnd(e, 'to'); drag = null; return; }
    if (drag.mode === 'endpoint') { finalizeEnd(e, drag.end); drag = null; return; }
    snapshot(); renderEls(); if (drag.el && drag.el.type === 'badge') renderSlides();
    drag = null;
  });
  // resolve a connector endpoint after a link/endpoint drag: snap onto an element or drop an anchor
  function finalizeEnd(e, end) {
    try { canvas.releasePointerCapture(drag.pid); } catch (_) {}
    const s = activeSlide(); const conn = s.els.find((x) => x.id === drag.connId); if (!conn) return;
    const cr = canvas.getBoundingClientRect();
    const pt = { x: (e.clientX - cr.left) / scale, y: (e.clientY - cr.top) / scale };
    const otherRef = conn[end === 'to' ? 'from' : 'to'].ref;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const tNode = under && under.closest('.el');
    const tEl = tNode && s.els.find((x) => x.id === tNode.dataset.id);
    if (tEl && tEl.id !== conn.id && tEl.id !== otherRef && ['anchor', 'highlight', 'badge', 'callout'].includes(tEl.type)) {
      conn[end] = { ref: tEl.id };                       // snap onto an existing element
    } else {
      const A = { id: uid('e_'), type: 'anchor', x: Math.round(pt.x - 15), y: Math.round(pt.y - 15), w: 30, h: 30 };
      s.els.push(A); conn[end] = { ref: A.id };          // drop an invisible anchor where released
    }
    selId = conn.id; pruneConnectors(); snapshot(); renderAll();
  }

  // deselect on empty canvas click
  canvas.addEventListener('pointerdown', (e) => { if (e.target === canvas) { selId = null; cropId = null; renderEls(); renderProps(); } });

  // scroll to zoom while cropping
  canvas.addEventListener('wheel', (e) => {
    if (!cropId) return;
    const node = canvas.querySelector(`[data-id="${cropId}"]`);
    if (!node || !node.contains(e.target)) return;
    e.preventDefault();
    const el = activeSlide().els.find((x) => x.id === cropId);
    el.zoom = Math.max(1, Math.min(5, (el.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.926)));
    applyCrop(node, el); applyMagnifiers(); debSnapshot();
  }, { passive: false });
  let snapT; function debSnapshot() { clearTimeout(snapT); snapT = setTimeout(() => { snapshot(); renderProps(); }, 350); }

  // ---- caption editing --------------------------------------------
  document.querySelectorAll('[data-bind]').forEach((n) => {
    n.addEventListener('input', () => { activeSlide()[n.dataset.bind] = n.innerHTML; save(); });
    n.addEventListener('blur', () => snapshot());
  });

  // ---- palette / toolbar wiring -----------------------------------
  $('#palette').addEventListener('click', (e) => { const t = e.target.closest('[data-add]'); if (!t) return; if (t.dataset.add === 'connector') return addConnector(); addEl(t.dataset.add); });
  document.querySelectorAll('[data-frame]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.frame === 'upload') $('#fileInput').click();
    else addEl('frame', { src: '', chrome: 'app' }), toast('Demo window inserted — swap in a real capture in the extension');
  }));
  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => captureInto(r.result);
    r.readAsDataURL(f); e.target.value = '';
  });
  $('#addSlide').addEventListener('click', addSlide);
  $('#guideTitle').addEventListener('input', (e) => { guide.title = e.target.value; save(); });
  $('#guideTitle').value = guide.title;
  $('#bgLight').addEventListener('click', () => setBg('light'));
  $('#bgDark').addEventListener('click', () => setBg('dark'));
  function setBg(v) { guide.bg = v; $('#bgLight').classList.toggle('on', v === 'light'); $('#bgDark').classList.toggle('on', v === 'dark'); snapshot(); renderAll(); }

  $('#editDone').addEventListener('click', finishArrowEdit);

  // optional per-slide header
  $('#addHeaderBtn').addEventListener('click', () => { activeSlide().caption = true; snapshot(); renderAll(); });
  $('#rmHeaderBtn').addEventListener('click', () => { activeSlide().caption = false; snapshot(); renderAll(); });

  // capture destination + projects/dashboard wiring
  $('#capTarget').addEventListener('change', (e) => { captureTarget = e.target.value; });
  $('#projectsBtn').addEventListener('click', showDashboard);
  $('#dashNew').addEventListener('click', createProject);
  $('#dashGrid').addEventListener('click', (e) => {
    if (e.target.closest('[data-dnew]')) return createProject();
    const card = e.target.closest('[data-pid]'); if (!card) return;
    const id = card.dataset.pid; const act = e.target.closest('[data-d]')?.dataset.d;
    if (act === 'rename') { const t = prompt('Rename guide', store.projects[id].title); if (t != null) { store.projects[id].title = t.trim() || store.projects[id].title; if (id === guide.id) $('#guideTitle').value = store.projects[id].title; saveStore(); renderDashboard(); } return; }
    if (act === 'dup') { const c = JSON.parse(JSON.stringify(store.projects[id])); c.id = uid('p_'); c.title = store.projects[id].title + ' copy'; c.updatedAt = Date.now(); store.projects[c.id] = c; saveStore(); renderDashboard(); return; }
    if (act === 'del') {
      if (Object.keys(store.projects).length <= 1) { toast('Keep at least one guide'); return; }
      if (!confirm('Delete “' + store.projects[id].title + '”? This can’t be undone.')) return;
      delete store.projects[id];
      if (guide.id === id) { guide = Object.values(store.projects)[0]; store.activeId = guide.id; history = []; hidx = -1; snapshot(); renderAll(); }
      saveStore(); renderDashboard(); return;
    }
    openProject(id);
  });

  // capture hook (filled by background.js when run as extension)
  window.__insertCapture = (dataUrl, url) => captureInto(dataUrl, url);

  // bridge to the service worker's snap flow (extension only; no-op standalone)
  function setupCaptureBridge() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;
    let handled = null;
    const handle = (id, dataUrl, url) => {
      if (!dataUrl || id === handled) return; // dedupe storage + message paths
      handled = id;
      window.__insertCapture(dataUrl, url);
      toast('Screenshot captured → centered as a new frame');
      try { chrome.storage.local.remove(['pendingCapture', 'captureId', 'captureUrl']); } catch (e) {}
    };
    chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'ugs-capture') handle(msg.id, msg.dataUrl, msg.url); });
    try { chrome.storage.local.get(['pendingCapture', 'captureId', 'captureUrl'], (r) => { if (r && r.pendingCapture) handle(r.captureId, r.pendingCapture, r.captureUrl); }); } catch (e) {}
  }

  // ---- headless-render hooks (used by scripts/render.mjs) ----------
  window.__ugs = {
    slideCount: () => guide.slides.length,
    gotoSlide: (i) => { guide.activeId = guide.slides[i].id; selId = null; renderAll(); },
    loadGuide: (g) => { g.id = g.id || ('job_' + uid('')); store.projects[g.id] = g; saveStore(); openProject(g.id); },
    getGuide: () => guide,
    // freeze the stage at 1:1 with no editor chrome so element screenshots are exact
    renderMode: () => {
      document.body.classList.add('render');
      scaler.style.transform = 'none';
      scale = 1;                 // keep the JS scale in sync (magnifier math depends on it)
      selId = null; cropId = null;
      renderEls();               // re-render at 1:1 → crop + magnifier mapping exact
    },
  };

  // ---- keyboard ----------------------------------------------------
  document.addEventListener('keydown', (e) => {
    const editing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === ']' || e.key === '[')) { if (selId) { e.preventDefault(); moveLayer(selId, e.key === ']' ? 1 : -1); } return; }
    if (e.key === 'Escape' && drag && drag.mode === 'link') { const s = activeSlide(); s.els = s.els.filter((x) => x.id !== drag.connId); drag = null; selId = null; renderAll(); return; }
    if (e.key === 'Escape' && cropId) { cropId = null; renderAll(); return; }
    if (e.key === 'Escape' && selId && !editing) { selId = null; renderAll(); return; }
    if (!editing && (e.key === 'Backspace' || e.key === 'Delete') && selId && cropId !== selId) { e.preventDefault(); deleteSel(); }
  });

  // ---- zoom --------------------------------------------------------
  function fit() {
    const pad = 48;
    scale = Math.min((wrap.clientWidth - pad) / STAGE_W, (wrap.clientHeight - pad) / STAGE_H);
    applyScale('Fit');
  }
  function applyScale(lbl) { scaler.style.transform = `scale(${scale})`; $('#zoomLbl').textContent = lbl || Math.round(scale * 100) + '%'; }
  $('#zoomIn').addEventListener('click', () => { scale = Math.min(2, scale + 0.1); applyScale(); });
  $('#zoomOut').addEventListener('click', () => { scale = Math.max(0.2, scale - 0.1); applyScale(); });
  $('#zoomFit').addEventListener('click', fit);
  window.addEventListener('resize', fit);

  // ---- export ------------------------------------------------------
  $('#exportJson').addEventListener('click', () => {
    download(`${slug(guide.title)}.json`, 'application/json', JSON.stringify(guide, null, 2));
    toast('Guide JSON exported (Remotion-ready)');
  });
  $('#exportPng').addEventListener('click', () => exportPng());

  async function exportPng() {
    toast('Rendering PNG…');
    const css = await fetchCss();
    const clone = stage.cloneNode(true);
    // strip editor-only chrome
    clone.querySelectorAll('.handle').forEach((n) => n.remove());
    clone.querySelectorAll('.el.selected').forEach((n) => n.classList.remove('selected'));
    clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    const html = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${STAGE_W}px;height:${STAGE_H}px">
      <style>${css}</style>${clone.outerHTML}</div>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_W}" height="${STAGE_H}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
    const img = new Image();
    img.onload = () => {
      const sc = 2, c = document.createElement('canvas');
      c.width = STAGE_W * sc; c.height = STAGE_H * sc;
      const ctx = c.getContext('2d'); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0);
      c.toBlob((b) => {
        const idx = guide.slides.indexOf(activeSlide()) + 1;
        downloadBlob(`${slug(guide.title)}-step-${String(idx).padStart(2, '0')}.png`, b);
        toast('PNG exported @2x · (glass blur flattens in this preview export — see README for the pixel-perfect Playwright path)');
      });
    };
    img.onerror = () => toast('Export needs the real extension/Playwright path for full fidelity — JSON export always works');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  let cssCache = null;
  async function fetchCss() {
    if (cssCache) return cssCache;
    try {
      const [a, b] = await Promise.all([fetch('tokens.css').then((r) => r.text()), fetch('editor.css').then((r) => r.text())]);
      cssCache = a + '\n' + b; return cssCache;
    } catch (e) { return ''; }
  }

  // ---- utils -------------------------------------------------------
  function download(name, type, data) { downloadBlob(name, new Blob([data], { type })); }
  function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function slug(s) { return (s || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }
  function escapeHtml(s) { return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }

  // ---- boot --------------------------------------------------------
  snapshot();
  renderAll();
  fit();
  setupCaptureBridge();

  // ---- Guide Studio bridge: load/save a job's guide.json via ?job=<slug> ----
  (function jobBridge() {
    const slug = new URLSearchParams(location.search).get('job'); if (!slug) return;
    fetch(`/api/jobs/${slug}`).then((r) => r.json()).then((d) => {
      if (!d || !d.guide) { toast('No guide.json yet — run the job first'); return; }
      d.guide.title = d.guide.title || slug;
      window.__ugs.loadGuide(d.guide);
      const bar = document.querySelector('.topbar'); if (!bar) return;
      const btn = document.createElement('button');
      btn.className = 'btn green'; btn.textContent = '✓ Save to job'; btn.style.marginLeft = '6px';
      btn.onclick = () => fetch(`/api/jobs/${slug}/guide`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(window.__ugs.getGuide(), null, 2) })
        .then(() => toast('Saved to job — hit Re-render in Guide Studio'));
      bar.appendChild(btn);
      toast(`Editing job “${slug}” — Save to job when done`);
    }).catch(() => {});
  })();
})();
