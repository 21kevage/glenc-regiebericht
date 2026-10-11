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
let signatureData = '';

function localDate() { return new Date().toLocaleDateString('en-CA'); }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()); }
function formatDate(date) { return validDate(date) ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`)) : '–'; }
function parseHours(value) { const hours = Number(String(value || '').replace(',', '.')); return Number.isFinite(hours) && hours >= 0 && hours <= 24 ? hours : 0; }
function formatHours(value) { return parseHours(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function clampText(value, maxLength) { return String(value || '').slice(0, maxLength); }
function validSignature(value) { return typeof value === 'string' && value.length <= 2_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : ''; }
function normalizePosition(value) { return { description: clampText(value?.description, 2000).trim(), hours: parseHours(value?.hours) }; }

function normalizeReport(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    id: clampText(value.id, 100) || (crypto.randomUUID?.() || String(Date.now())),
    project: clampText(value.project, 160).trim(),
    date: validDate(value.date) ? value.date : localDate(),
    positions: Array.isArray(value.positions) ? value.positions.slice(0, 100).map(normalizePosition) : [],
    signature: validSignature(value.signature),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  };
}

function getStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return { current: null, reports: [] };
    return {
      current: normalizeReport(stored.current),
      reports: Array.isArray(stored.reports) ? stored.reports.map(normalizeReport).filter(Boolean).slice(0, 50) : []
    };
  } catch {
    return { current: null, reports: [] };
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    statusEl.textContent = 'Speichern nicht möglich';
    return false;
  }
}

function positions() {
  return [...positionsEl.querySelectorAll('.position')].map(item => normalizePosition({
    description: item.querySelector('textarea').value,
    hours: item.querySelector('.hours-input').value
  }));
}

function reportData() {
  return normalizeReport({
    id: crypto.randomUUID?.() || String(Date.now()),
    project: projectEl.value,
    date: dateEl.value,
    positions: positions(),
    signature: signatureData,
    updatedAt: new Date().toISOString()
  });
}

function totalHours(data = positions()) { return data.reduce((sum, item) => sum + parseHours(item.hours), 0); }
function updateTotal() { $('#total-hours').textContent = `${formatHours(totalHours())} Std.`; }
function updateNumbers() { [...positionsEl.children].forEach((item, index) => item.querySelector('.position-number').textContent = `${index + 1}.`); }
function markSaved() { statusEl.textContent = 'Entwurf gespeichert'; window.setTimeout(() => statusEl.textContent = 'Entwurf bereit', 1800); }

function addPosition(values = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector('textarea').value = clampText(values.description, 2000);
  node.querySelector('.hours-input').value = parseHours(values.hours) || '';
  node.querySelector('.remove-position').addEventListener('click', () => {
    if (positionsEl.children.length > 1) {
      node.remove();
      updateNumbers();
      saveCurrent();
    }
  });
  node.querySelectorAll('input,textarea').forEach(control => control.addEventListener('input', saveCurrent));
  node.querySelector('.hours-input').addEventListener('change', event => {
    event.target.value = parseHours(event.target.value) || '';
    saveCurrent();
  });
  positionsEl.append(node);
  updateNumbers();
}

function resizeCanvas(restore = true) {
  const previous = restore && canvas.width ? canvas.toDataURL() : '';
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#241e16';
  context.lineWidth = 2.2;
  if (previous) {
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
    image.src = previous;
  }
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener('pointerdown', event => {
  drawing = true;
  canvas.setPointerCapture(event.pointerId);
  const p = point(event);
  context.beginPath();
  context.moveTo(p.x, p.y);
});
canvas.addEventListener('pointermove', event => {
  if (!drawing) return;
  const p = point(event);
  context.lineTo(p.x, p.y);
  context.stroke();
});
canvas.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  signatureData = validSignature(canvas.toDataURL('image/png'));
  saveCurrent();
});
canvas.addEventListener('pointercancel', () => { drawing = false; });
$('#clear-signature').addEventListener('click', () => {
  context.clearRect(0, 0, canvas.width, canvas.height);
  signatureData = '';
  saveCurrent();
});
window.addEventListener('resize', () => resizeCanvas());

function saveCurrent() {
  updateTotal();
  if (!projectEl.value.trim() && !positions().some(position => position.description || position.hours) && !signatureData) return;
  const store = getStore();
  store.current = reportData();
  if (saveStore(store)) markSaved();
  renderHistory();
}

function renderHistory() {
  const { reports = [], current } = getStore();
  const list = [current, ...reports].filter(Boolean).slice(0, 8);
  if (!list.length) {
    historyEl.innerHTML = '<p class="empty-history">Noch keine Entwürfe gespeichert.</p>';
    return;
  }
  historyEl.innerHTML = list.map((report, index) => `<article class="history-item"><div><p class="history-name">${escapeHtml(report.project || 'Unbenannter Entwurf')}</p><p class="history-detail">${formatDate(report.date)} · ${formatHours(totalHours(report.positions))} Std. · ${index === 0 ? 'aktueller Entwurf' : 'gespeichert'}</p></div><button class="load-button" type="button" data-id="${escapeHtml(report.id)}">Öffnen</button></article>`).join('');
  historyEl.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => loadReport(list.find(report => report.id === button.dataset.id))));
}

function loadReport(report) {
  if (!report) return;
  projectEl.value = report.project;
  dateEl.value = report.date;
  positionsEl.innerHTML = '';
  (report.positions.length ? report.positions : [{}]).forEach(addPosition);
  signatureData = report.signature;
  resizeCanvas(false);
  if (signatureData) {
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
    image.src = signatureData;
  }
  const store = getStore();
  store.current = report;
  saveStore(store);
  updateTotal();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function newReport() {
  const current = reportData();
  if ((current.project || current.positions.some(item => item.description || item.hours)) && !confirm('Aktuellen Entwurf als abgeschlossenen Bericht ablegen und neu beginnen?')) return;
  const store = getStore();
  if (current.project || current.positions.some(item => item.description || item.hours)) store.reports = [current, ...store.reports].slice(0, 50);
  store.current = null;
  saveStore(store);
  projectEl.value = '';
  dateEl.value = localDate();
  positionsEl.innerHTML = '';
  addPosition();
  signatureData = '';
  resizeCanvas(false);
  updateTotal();
  renderHistory();
}

async function printReport() {
  const data = reportData();
  if (!data.project) {
    projectEl.focus();
    alert('Bitte zuerst den Projektnamen eintragen.');
    return;
  }
  const meaningful = data.positions.filter(position => position.description || position.hours);
  if (!meaningful.length) {
    alert('Bitte mindestens eine Tätigkeitsposition eintragen.');
    return;
  }
  const rows = meaningful.map((position, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(position.description).replace(/\n/g, '<br>')}</td><td>${formatHours(position.hours)}</td></tr>`).join('');
  const signature = data.signature ? `<img class="pdf-signature" src="${data.signature}" alt="Unterschrift Dawid Glenc">` : '<span class="signature-placeholder">Nicht unterschrieben</span>';
  $('#print-root').innerHTML = `<section class="pdf-page"><header class="pdf-head"><img class="pdf-logo" src="${new URL('assets/logo.png', document.baseURI).href}" alt="Glenc Innenausbau GmbH"><div class="pdf-company"><strong>${COMPANY.name}</strong><br>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}<br>USt-IdNr. ${COMPANY.vat}</div></header><p class="pdf-document-type">Leistungsnachweis</p><h1 class="pdf-title">Regiebericht</h1><div class="pdf-meta"><div><b>Projekt</b>${escapeHtml(data.project)}</div><div><b>Datum</b>${formatDate(data.date)}</div></div><table class="pdf-table"><thead><tr><th>Pos.</th><th>Tätigkeitsbeschreibung</th><th>Stunden</th></tr></thead><tbody>${rows}</tbody></table><div class="pdf-total"><span>Gesamtstunden</span><strong>${formatHours(totalHours(meaningful))} Std.</strong></div><div class="pdf-sign-block"><div class="pdf-sign-box">${signature}</div><small>Unterschrift Dawid Glenc</small></div><footer class="pdf-footer"><span>${COMPANY.name}</span><span>Regiebericht · ${escapeHtml(data.project)}</span></footer></section>`;
  const logo = $('#print-root .pdf-logo');
  if (!logo.complete || !logo.naturalWidth) {
    await new Promise(resolve => {
      logo.addEventListener('load', resolve, { once: true });
      logo.addEventListener('error', resolve, { once: true });
    });
  }
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const oldTitle = document.title;
  const safeProject = data.project.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) || 'Projekt';
  document.title = `Regiebericht_${safeProject}_${data.date || localDate()}`;
  window.print();
  document.title = oldTitle;
}

$('#add-position').addEventListener('click', () => {
  addPosition();
  positionsEl.lastElementChild.querySelector('textarea').focus();
});
$('#new-report').addEventListener('click', newReport);
$('#create-pdf').addEventListener('click', printReport);
[projectEl, dateEl].forEach(control => control.addEventListener('input', saveCurrent));
dateEl.value = localDate();
resizeCanvas(false);
addPosition();
const current = getStore().current;
if (current) loadReport(current);
renderHistory();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(() => {}));
}
