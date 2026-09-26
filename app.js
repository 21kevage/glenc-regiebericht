const COMPANY = {
  name: 'Glenc Innenausbau GmbH',
  address: 'Am Pfarrfeld 8A · 84166 Adlkofen',
  phone: '+49 (0) 170 9641492',
  email: 'info@glenc-innenausbau.de',
  vat: 'DE 360006621'
};
const STORAGE_KEY = 'glenc-regiebericht-v1';
const $ = selector => document.querySelector(selector);
const positionsEl = $('#positions');
const template = $('#position-template');
const projectEl = $('#project-name');
const dateEl = $('#report-date');
const statusEl = $('#save-status');
const historyEl = $('#history-list');
const canvas = $('#signature-pad');
const context = canvas.getContext('2d');
let drawing = false;
let hasSignature = false;
let signatureData = '';

function localDate() { return new Date().toLocaleDateString('en-CA'); }
function formatDate(date) { return date ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`)) : '–'; }
function formatHours(value) { return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
function getStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { current: null, reports: [] }; } catch { return { current: null, reports: [] }; } }
function saveStore(store) { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function positions() { return [...positionsEl.querySelectorAll('.position')].map(item => ({ description: item.querySelector('textarea').value.trim(), hours: item.querySelector('.hours-input').value })); }
function reportData() { return { id: crypto.randomUUID?.() || String(Date.now()), project: projectEl.value.trim(), date: dateEl.value, positions: positions(), signature: signatureData, updatedAt: new Date().toISOString() }; }
function totalHours(data = positions()) { return data.reduce((sum, item) => sum + (Number(String(item.hours).replace(',', '.')) || 0), 0); }
function updateTotal() { $('#total-hours').textContent = `${formatHours(totalHours())} Std.`; }
function updateNumbers() { [...positionsEl.children].forEach((item, index) => item.querySelector('.position-number').textContent = `${index + 1}.`); }
function markSaved() { statusEl.textContent = 'Entwurf gespeichert'; window.setTimeout(() => statusEl.textContent = 'Entwurf bereit', 1800); }

function addPosition(values = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('textarea').value = values.description || '';
  node.querySelector('.hours-input').value = values.hours || '';
  node.querySelector('.remove-position').addEventListener('click', () => { if (positionsEl.children.length > 1) { node.remove(); updateNumbers(); saveCurrent(); } });
  node.querySelectorAll('input,textarea').forEach(control => control.addEventListener('input', saveCurrent));
  positionsEl.append(node);
  updateNumbers();
}

function resizeCanvas(restore = true) {
  const previous = restore && canvas.width ? canvas.toDataURL() : '';
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio; canvas.height = rect.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#241e16'; context.lineWidth = 2.2;
  if (previous) { const image = new Image(); image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height); image.src = previous; }
}
function point(event) { const rect = canvas.getBoundingClientRect(); return { x:event.clientX - rect.left, y:event.clientY - rect.top }; }
canvas.addEventListener('pointerdown', event => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
canvas.addEventListener('pointermove', event => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); hasSignature = true; });
canvas.addEventListener('pointerup', () => { if (!drawing) return; drawing = false; signatureData = canvas.toDataURL('image/png'); saveCurrent(); });
canvas.addEventListener('pointercancel', () => drawing = false);
$('#clear-signature').addEventListener('click', () => { context.clearRect(0, 0, canvas.width, canvas.height); signatureData = ''; hasSignature = false; saveCurrent(); });
window.addEventListener('resize', () => resizeCanvas());

function saveCurrent() {
  updateTotal();
  if (!projectEl.value.trim() && !positions().some(position => position.description || position.hours) && !signatureData) return;
  const store = getStore();
  store.current = reportData(); saveStore(store); markSaved(); renderHistory();
}
function renderHistory() {
  const { reports = [], current } = getStore();
  const list = [current, ...reports].filter(Boolean).slice(0, 8);
  if (!list.length) { historyEl.innerHTML = '<p class="empty-history">Noch keine Entwürfe gespeichert.</p>'; return; }
  historyEl.innerHTML = list.map((report, index) => `<article class="history-item"><div><p class="history-name">${escapeHtml(report.project || 'Unbenannter Entwurf')}</p><p class="history-detail">${formatDate(report.date)} · ${formatHours(totalHours(report.positions || []))} Std. · ${index === 0 ? 'aktueller Entwurf' : 'gespeichert'}</p></div><button class="load-button" type="button" data-id="${report.id}">Öffnen</button></article>`).join('');
  historyEl.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => loadReport(list.find(report => report.id === button.dataset.id))));
}
function loadReport(report) {
  if (!report) return;
  projectEl.value = report.project || ''; dateEl.value = report.date || localDate(); positionsEl.innerHTML = '';
  (report.positions?.length ? report.positions : [{}]).forEach(addPosition);
  signatureData = report.signature || ''; hasSignature = Boolean(signatureData); resizeCanvas(false);
  if (signatureData) { const image = new Image(); image.onload = () => context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight); image.src = signatureData; }
  const store = getStore(); store.current = report; saveStore(store); updateTotal(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function newReport() {
  const current = reportData();
  if ((current.project || current.positions.some(item => item.description || item.hours)) && !confirm('Aktuellen Entwurf als abgeschlossenen Bericht ablegen und neu beginnen?')) return;
  const store = getStore();
  if (current.project || current.positions.some(item => item.description || item.hours)) store.reports = [current, ...(store.reports || [])].slice(0, 50);
  store.current = null; saveStore(store);
  projectEl.value = ''; dateEl.value = localDate(); positionsEl.innerHTML = ''; addPosition(); signatureData = ''; resizeCanvas(false); updateTotal(); renderHistory();
}

async function printReport() {
  const data = reportData();
  if (!data.project) { projectEl.focus(); alert('Bitte zuerst den Projektnamen eintragen.'); return; }
  const meaningful = data.positions.filter(position => position.description || position.hours);
  if (!meaningful.length) { alert('Bitte mindestens eine Tätigkeitsposition eintragen.'); return; }
  const rows = meaningful.map((position, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(position.description).replace(/\n/g, '<br>')}</td><td>${formatHours(position.hours)}</td></tr>`).join('');
  const signature = data.signature ? `<img class="pdf-signature" src="${data.signature}" alt="Unterschrift Dawid Glenc">` : '<span class="signature-placeholder">Nicht unterschrieben</span>';
  $('#print-root').innerHTML = `<section class="pdf-page"><style>@page{size:A4;margin:16mm} .pdf-page{color:#211b14;font-family:Arial,sans-serif;font-size:10.5pt}.pdf-head{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #c89014;padding-bottom:10mm}.pdf-logo{width:76mm;height:25mm;object-fit:contain;object-position:left top}.pdf-company{text-align:right;font-size:8.2pt;color:#5e574f;line-height:1.5}.pdf-company strong{color:#211b14;font-size:9.5pt}.pdf-document-type{margin:8mm 0 1.5mm;color:#a8750b;font-size:7.8pt;font-weight:700;letter-spacing:.16em}.pdf-title{margin:0 0 7mm;font:700 23pt Georgia,serif;letter-spacing:-.02em}.pdf-meta{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:9mm;padding:5mm;background:#f6f2ea}.pdf-meta b{display:block;margin-bottom:1.5mm;font-size:8pt;text-transform:uppercase;letter-spacing:.08em;color:#665f57}.pdf-table{width:100%;border-collapse:collapse}.pdf-table th{padding:3mm;background:#241e16;color:#fff;text-align:left;font-size:8.5pt}.pdf-table td{padding:4mm 3mm;border-bottom:1px solid #d9d1c4;vertical-align:top}.pdf-table th:first-child,.pdf-table td:first-child{width:11mm;text-align:center}.pdf-table th:last-child,.pdf-table td:last-child{width:28mm;text-align:right}.pdf-total{display:flex;justify-content:flex-end;gap:20mm;margin-top:7mm;padding:4mm 0;border-top:2px solid #241e16;font-size:12pt}.pdf-sign-block{margin-top:24mm;width:72mm}.pdf-sign-box{height:28mm;border-bottom:1px solid #756d63;display:flex;align-items:end}.pdf-signature{width:68mm;max-height:27mm;object-fit:contain;object-position:left bottom}.signature-placeholder{font-size:8pt;color:#80786e;margin-bottom:3mm}.pdf-footer{position:fixed;bottom:0;width:100%;padding-top:4mm;border-top:1px solid #d9d1c4;color:#665f57;font-size:7.5pt;display:flex;justify-content:space-between}</style><header class="pdf-head"><img class="pdf-logo" src="${new URL('assets/logo.png', document.baseURI).href}" alt="Glenc Innenausbau GmbH"><div class="pdf-company"><strong>${COMPANY.name}</strong><br>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}<br>USt-IdNr. ${COMPANY.vat}</div></header><p class="pdf-document-type">Leistungsnachweis</p><h1 class="pdf-title">Regiebericht</h1><div class="pdf-meta"><div><b>Projekt</b>${escapeHtml(data.project)}</div><div><b>Datum</b>${formatDate(data.date)}</div></div><table class="pdf-table"><thead><tr><th>Pos.</th><th>Tätigkeitsbeschreibung</th><th>Stunden</th></tr></thead><tbody>${rows}</tbody></table><div class="pdf-total"><span>Gesamtstunden</span><strong>${formatHours(totalHours(meaningful))} Std.</strong></div><div class="pdf-sign-block"><div class="pdf-sign-box">${signature}</div><small>Unterschrift Dawid Glenc</small></div><footer class="pdf-footer"><span>${COMPANY.name}</span><span>Regiebericht · ${escapeHtml(data.project)}</span></footer></section>`;
  const logo = $('#print-root .pdf-logo');
  if (!logo.complete || !logo.naturalWidth) {
    await new Promise(resolve => {
      logo.addEventListener('load', resolve, { once: true });
      logo.addEventListener('error', resolve, { once: true });
    });
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const oldTitle = document.title; document.title = `Regiebericht_${data.project.replace(/[^a-z0-9]+/gi, '_')}_${data.date || localDate()}`; window.print(); document.title = oldTitle;
}

$('#add-position').addEventListener('click', () => { addPosition(); positionsEl.lastElementChild.querySelector('textarea').focus(); });
$('#new-report').addEventListener('click', newReport);
$('#create-pdf').addEventListener('click', printReport);
[projectEl, dateEl].forEach(control => control.addEventListener('input', saveCurrent));
dateEl.value = localDate(); resizeCanvas(false); addPosition();
const current = getStore().current; if (current) loadReport(current); renderHistory();
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(registration => registration.update()));
