/* Guide Studio UI — job board + markdown split editor. */
const $ = (s) => document.querySelector(s);
let current = null;
let toastT;
let bust = Date.now();             // cache-buster appended to rendered image URLs
let lastRev = 0, revTimer = null;  // live-reload poll state
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); };

// ---- live reload: poll the open job's asset mtime; refresh the preview on change ----
function startLiveReload() {
  clearInterval(revTimer); lastRev = 0;
  revTimer = setInterval(async () => {
    if (!current) return;
    try {
      const { rev } = await fetch(`/api/jobs/${current}/rev`).then((r) => r.json());
      if (rev && lastRev && rev !== lastRev) { bust = rev; renderPreview(); loadJobs(); toast('Preview updated'); }
      lastRev = rev || lastRev;
    } catch {}
  }, 1200);
}

// ---- tiny markdown renderer (covers what /guide produces) ----
function md2html(src, slug) {
  src = src.replace(/^---\n[\s\S]*?\n---\n/, '');                         // strip frontmatter
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const inline = (s) => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, u) => `<img alt="${a}" src="${u.startsWith('assets/') ? `/api/jobs/${slug}/asset/${u.slice(7)}?v=${bust}` : u}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = src.split('\n'); let html = '', list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line) { closeList(); continue; }
    let mm;
    if ((mm = line.match(/^(#{1,4})\s+(.*)/))) { closeList(); html += `<h${mm[1].length}>${inline(mm[2])}</h${mm[1].length}>`; }
    else if (/^>\s?/.test(line)) { closeList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`; }
    else if (/^(-|\*)\s+/.test(line)) { if (list !== 'ul') { closeList(); list = 'ul'; html += '<ul>'; } html += `<li>${inline(line.replace(/^(-|\*)\s+/, ''))}</li>`; }
    else if (/^\d+\.\s+/.test(line)) { if (list !== 'ol') { closeList(); list = 'ol'; html += '<ol>'; } html += `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`; }
    else if (/^(---|___)\s*$/.test(line)) { closeList(); html += '<hr>'; }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList(); return html;
}

const stateClass = (s) => ['ready', 'draft', 'error', 'capturing', 'rendering', 'assembling'].includes(s) ? s : 'draft';

async function loadJobs() {
  const jobs = await fetch('/api/jobs').then((r) => r.json());
  $('#count').textContent = jobs.length;
  $('#jobs').innerHTML = jobs.map((j) => `
    <div class="job ${j.slug === current ? 'on' : ''} ${j.ready ? 'is-ready' : ''}" data-slug="${j.slug}">
      <div class="t">${j.title}</div>
      <div class="m"><span class="state ${stateClass(j.state)}">${j.state}</span> · ${j.steps} steps · ${j.images} imgs</div>
      <button class="ready-btn ${j.ready ? 'on' : ''}" data-ready="${j.slug}" title="Mark this guide ready to go">${j.ready ? '✓ Ready to go' : 'Mark ready'}</button>
    </div>`).join('') || '<p style="font-size:12.5px;color:var(--muted);padding:6px">No guides yet. Run <b>/guide</b> in Claude Code.</p>';
  document.querySelectorAll('.job').forEach((el) => el.addEventListener('click', () => openJob(el.dataset.slug)));
  document.querySelectorAll('.ready-btn').forEach((el) => el.addEventListener('click', async (e) => {
    e.stopPropagation();                                   // don't open the guide — just toggle
    const slug = el.dataset.ready, on = !el.classList.contains('on');
    await fetch(`/api/jobs/${slug}/ready`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ready: on }) });
    toast(on ? 'Marked ready to go' : 'Unmarked');
    loadJobs();
  }));
}

async function openJob(slug) {
  current = slug;
  const d = await fetch(`/api/jobs/${slug}`).then((r) => r.json());
  $('#title').textContent = d.job?.title || slug;
  $('#md').value = d.md || '';
  renderPreview();
  ['save', 'images', 'rerender'].forEach((id) => ($('#' + id).disabled = false));
  loadJobs();
  startLiveReload();
}

function renderPreview() { $('#doc').innerHTML = md2html($('#md').value || '', current); }

$('#md').addEventListener('input', renderPreview);
$('#save').addEventListener('click', async () => {
  await fetch(`/api/jobs/${current}/md`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: $('#md').value });
  toast('Markdown saved');
});
$('#images').addEventListener('click', () => window.open(`/editor/?job=${current}`, '_blank'));
$('#rerender').addEventListener('click', async () => {
  toast('Re-rendering from edited images…'); $('#rerender').disabled = true;
  const r = await fetch(`/api/jobs/${current}/render`, { method: 'POST' }).then((x) => x.json());
  $('#rerender').disabled = false;
  if (r.ok) { await openJob(current); toast('Re-rendered — preview updated'); } else toast('Render failed (see console)'), console.log(r.log);
});

loadJobs();
