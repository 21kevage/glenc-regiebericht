const COMPANY = {
  name: 'Glenc Innenausbau GmbH',
  address: 'Am Pfarrfeld 8A · 84166 Adlkofen',
  phone: '+49 (0) 170 9641492',
  email: 'info@glenc-innenausbau.de',
  vat: 'DE 360006621'
};

const STORAGE_KEY = 'glenc-regiebericht-v1';
const EMPLOYEE_STORAGE_KEY = 'glenc-regiebericht-employees-v1';
const $ = selector => document.querySelector(selector);
const positionsEl = $('#positions');
const positionTemplate = $('#position-template');
const assignmentTemplate = $('#assignment-template');
const projectEl = $('#project-name');
const dateEl = $('#report-date');
const statusEl = $('#save-status');
const historyEl = $('#history-list');
const reportEmployeesEl = $('#report-employees');
const employeeMasterListEl = $('#employee-master-list');
const employeeNameEl = $('#employee-name');
const employeeRoleEl = $('#employee-role');
const canvas = $('#signature-pad');
const context = canvas.getContext('2d');
let drawing = false;
let signatureData = '';
let reportEmployees = [];

function localDate() { return new Date().toLocaleDateString('en-CA'); }
function makeId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()); }
function formatDate(date) { return validDate(date) ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`)) : '–'; }
function parseHours(value) { const hours = Number(String(value || '').replace(',', '.')); return Number.isFinite(hours) && hours >= 0 && hours <= 24 ? hours : 0; }
function formatHours(value) { return parseHours(value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function clampText(value, maxLength) { return String(value || '').slice(0, maxLength); }
function validSignature(value) { return typeof value === 'string' && value.length <= 2_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : ''; }
function normalizeEmployee(value) {
  const name = clampText(value?.name, 100).trim();
  if (!name) return null;
  return {
    id: clampText(value?.id, 100) || makeId(),
    name,
    role: value?.role === 'Helfer' ? 'Helfer' : 'Facharbeiter'
  };
}
function normalizeAssignment(value) {
  const employee = normalizeEmployee(value);
  return employee ? { ...employee, hours: parseHours(value?.hours) } : null;
}
function normalizePosition(value) {
  const hasAssignments = Array.isArray(value?.assignments);
  return {
    description: clampText(value?.description, 2000).trim(),
    assignments: hasAssignments ? value.assignments.slice(0, 20).map(normalizeAssignment).filter(Boolean) : [],
    legacyHours: parseHours(hasAssignments ? value?.legacyHours : (value?.legacyHours ?? value?.hours))
  };
}
function normalizeReport(value) {
  if (!value || typeof value !== 'object') return null;
  const employees = Array.isArray(value.employees) ? value.employees.slice(0, 100).map(normalizeEmployee).filter(Boolean) : [];
  return {
    id: clampText(value.id, 100) || makeId(),
    project: clampText(value.project, 160).trim(),
    date: validDate(value.date) ? value.date : localDate(),
    employees: employees.filter((employee, index, list) => list.findIndex(item => item.id === employee.id) === index),
    positions: Array.isArray(value.positions) ? value.positions.slice(0, 100).map(normalizePosition) : [],
    signature: validSignature(value.signature),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  };
}
function employeeHours(position) { return position.assignments.length ? position.assignments.reduce((sum, assignment) => sum + parseHours(assignment.hours), 0) : parseHours(position.legacyHours); }
function isMeaningful(position) { return Boolean(position.description || employeeHours(position)); }

function getEmployees() {
  try {
    const stored = JSON.parse(localStorage.getItem(EMPLOYEE_STORAGE_KEY));
    return Array.isArray(stored) ? stored.slice(0, 100).map(normalizeEmployee).filter(Boolean).filter((employee, index, list) => list.findIndex(item => item.id === employee.id) === index) : [];
  } catch {
    return [];
  }
}
function saveEmployees(employees) {
  try {
    localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employees));
    return true;
  } catch {
    statusEl.textContent = 'Speichern nicht möglich';
    return false;
  }
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

function renderEmployeeManager() {
  const employees = getEmployees();
  employeeMasterListEl.replaceChildren();
  if (!employees.length) {
    const empty = document.createElement('p');
    empty.className = 'employee-empty';
    empty.textContent = 'Noch keine Mitarbeiter angelegt.';
    employeeMasterListEl.append(empty);
    return;
  }
  employees.forEach(employee => {
    const item = document.createElement('div');
    item.className = 'employee-master-item';
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = employee.name;
    const role = document.createElement('small');
    role.textContent = employee.role;
    info.append(name, document.createElement('br'), role);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-employee';
    remove.textContent = 'Entfernen';
    remove.addEventListener('click', () => deleteEmployee(employee.id));
    item.append(info, remove);
    employeeMasterListEl.append(item);
  });
}
function renderReportEmployees() {
  const employees = getEmployees();
  const selectedIds = new Set(reportEmployees.map(employee => employee.id));
  reportEmployeesEl.replaceChildren();
  if (!employees.length) {
    const empty = document.createElement('p');
    empty.className = 'employee-empty';
    empty.textContent = 'Bitte zuerst mindestens einen Mitarbeiter anlegen.';
    reportEmployeesEl.append(empty);
    return;
  }
  employees.forEach(employee => {
    const label = document.createElement('label');
    label.className = 'employee-choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selectedIds.has(employee.id);
    const text = document.createElement('span');
    text.textContent = employee.name;
    const role = document.createElement('small');
    role.className = 'employee-role';
    role.textContent = employee.role;
    const details = document.createElement('span');
    details.append(text, role);
    input.addEventListener('change', () => {
      if (input.checked) reportEmployees = [...reportEmployees.filter(item => item.id !== employee.id), employee];
      else {
        reportEmployees = reportEmployees.filter(item => item.id !== employee.id);
        positionsEl.querySelectorAll('.assignment-row').forEach(row => {
          if (row.querySelector('.assignment-employee').value === employee.id) row.remove();
        });
      }
      refreshAssignmentOptions();
      updateAllPositionTotals();
      saveCurrent();
    });
    label.append(input, details);
    reportEmployeesEl.append(label);
  });
}
function addEmployee() {
  const employee = normalizeEmployee({ id: makeId(), name: employeeNameEl.value, role: employeeRoleEl.value });
  if (!employee) {
    employeeNameEl.focus();
    alert('Bitte den Namen des Mitarbeiters eintragen.');
    return;
  }
  const employees = getEmployees();
  if (employees.some(item => item.name.toLocaleLowerCase('de-DE') === employee.name.toLocaleLowerCase('de-DE'))) {
    alert('Dieser Mitarbeiter ist bereits angelegt.');
    return;
  }
  if (!saveEmployees([...employees, employee])) return;
  reportEmployees = [...reportEmployees, employee];
  employeeNameEl.value = '';
  employeeRoleEl.value = 'Facharbeiter';
  renderEmployeeManager();
  renderReportEmployees();
  refreshAssignmentOptions();
  saveCurrent();
}
function deleteEmployee(id) {
  const employee = getEmployees().find(item => item.id === id);
  if (!employee || !confirm(`${employee.name} aus der Mitarbeiteranlage entfernen? Bereits gespeicherte Berichte bleiben unverändert.`)) return;
  saveEmployees(getEmployees().filter(item => item.id !== id));
  reportEmployees = reportEmployees.filter(item => item.id !== id);
  positionsEl.querySelectorAll('.assignment-row').forEach(row => {
    if (row.querySelector('.assignment-employee').value === id) row.remove();
  });
  renderEmployeeManager();
  renderReportEmployees();
  refreshAssignmentOptions();
  updateAllPositionTotals();
  saveCurrent();
}

function assignments(node) {
  return [...node.querySelectorAll('.assignment-row')].map(row => {
    const employee = reportEmployees.find(item => item.id === row.querySelector('.assignment-employee').value);
    return employee ? { ...employee, hours: parseHours(row.querySelector('.assignment-hours').value) } : null;
  }).filter(Boolean);
}
function positions() {
  return [...positionsEl.querySelectorAll('.position')].map(item => normalizePosition({
    description: item.querySelector('textarea').value,
    assignments: assignments(item),
    legacyHours: item.dataset.legacyHours
  }));
}
function reportData() {
  return normalizeReport({
    id: getStore().current?.id || makeId(),
    project: projectEl.value,
    date: dateEl.value,
    employees: reportEmployees,
    positions: positions(),
    signature: signatureData,
    updatedAt: new Date().toISOString()
  });
}
function totalHours(data = positions()) { return data.reduce((sum, item) => sum + employeeHours(item), 0); }
function updateTotal() { $('#total-hours').textContent = `${formatHours(totalHours())} Std.`; }
function updateNumbers() { [...positionsEl.children].forEach((item, index) => item.querySelector('.position-number').textContent = `${index + 1}.`); }
function updatePositionTotal(node) { node.querySelector('.position-total strong').textContent = `${formatHours(employeeHours(normalizePosition({ assignments: assignments(node), legacyHours: node.dataset.legacyHours })))} Std.`; }
function updateAllPositionTotals() { [...positionsEl.children].forEach(updatePositionTotal); updateTotal(); }
function markSaved() { statusEl.textContent = 'Entwurf gespeichert'; window.setTimeout(() => statusEl.textContent = 'Entwurf bereit', 1800); }

function populateAssignmentSelect(select, selectedId = '') {
  const previousId = selectedId || select.value;
  select.replaceChildren();
  reportEmployees.forEach(employee => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = `${employee.name} · ${employee.role}`;
    select.append(option);
  });
  if (reportEmployees.some(employee => employee.id === previousId)) select.value = previousId;
  else if (reportEmployees.length) select.value = reportEmployees[0].id;
  select.dataset.previousId = select.value;
}
function refreshAssignmentOptions() {
  positionsEl.querySelectorAll('.assignment-employee').forEach(select => populateAssignmentSelect(select, select.value));
}
function addAssignment(position, value = {}) {
  if (!reportEmployees.length) {
    alert('Bitte zuerst mindestens einen Mitarbeiter für diesen Bericht auswählen.');
    return;
  }
  const node = assignmentTemplate.content.firstElementChild.cloneNode(true);
  const select = node.querySelector('.assignment-employee');
  const hours = node.querySelector('.assignment-hours');
  populateAssignmentSelect(select, value.id);
  hours.value = parseHours(value.hours) || '';
  select.addEventListener('change', () => {
    const selectedId = select.value;
    const duplicate = [...position.querySelectorAll('.assignment-employee')].some(other => other !== select && other.value === selectedId);
    if (duplicate) {
      alert('Dieser Mitarbeiter ist bereits in dieser Position eingetragen.');
      select.value = select.dataset.previousId;
      return;
    }
    select.dataset.previousId = selectedId;
    saveCurrent();
  });
  hours.addEventListener('input', saveCurrent);
  hours.addEventListener('change', event => {
    event.target.value = parseHours(event.target.value) || '';
    saveCurrent();
  });
  node.querySelector('.remove-assignment').addEventListener('click', () => {
    node.remove();
    saveCurrent();
  });
  position.querySelector('.assignments').append(node);
  updatePositionTotal(position);
}
function addPosition(values = {}) {
  const node = positionTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('textarea').value = clampText(values.description, 2000);
  node.dataset.legacyHours = parseHours(values.legacyHours) || '';
  node.querySelector('.remove-position').addEventListener('click', () => {
    if (positionsEl.children.length > 1) {
      node.remove();
      updateNumbers();
      saveCurrent();
    }
  });
  node.querySelector('textarea').addEventListener('input', saveCurrent);
  node.querySelector('.add-assignment').addEventListener('click', () => {
    addAssignment(node);
    saveCurrent();
  });
  const savedAssignments = Array.isArray(values.assignments) ? values.assignments : [];
  savedAssignments.forEach(assignment => addAssignment(node, assignment));
  if (!savedAssignments.length && parseHours(values.legacyHours)) {
    const legacy = document.createElement('p');
    legacy.className = 'legacy-hours';
    legacy.textContent = `Stunden aus bestehendem Bericht: ${formatHours(values.legacyHours)} Std.`;
    node.querySelector('.assignments').append(legacy);
  }
  positionsEl.append(node);
  updateNumbers();
  updatePositionTotal(node);
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
function point(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
canvas.addEventListener('pointerdown', event => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
canvas.addEventListener('pointermove', event => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); });
canvas.addEventListener('pointerup', () => { if (!drawing) return; drawing = false; signatureData = validSignature(canvas.toDataURL('image/png')); saveCurrent(); });
canvas.addEventListener('pointercancel', () => { drawing = false; });
$('#clear-signature').addEventListener('click', () => { context.clearRect(0, 0, canvas.width, canvas.height); signatureData = ''; saveCurrent(); });
window.addEventListener('resize', () => resizeCanvas());

function saveCurrent() {
  updateAllPositionTotals();
  const data = reportData();
  if (!data.project && !data.positions.some(isMeaningful) && !data.employees.length && !signatureData) return;
  const store = getStore();
  store.current = data;
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
function loadReport(report, scroll = true) {
  if (!report) return;
  projectEl.value = report.project;
  dateEl.value = report.date;
  reportEmployees = report.employees;
  renderReportEmployees();
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
  updateAllPositionTotals();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function newReport() {
  const current = reportData();
  if ((current.project || current.positions.some(isMeaningful)) && !confirm('Aktuellen Entwurf als abgeschlossenen Bericht ablegen und neu beginnen?')) return;
  const store = getStore();
  if (current.project || current.positions.some(isMeaningful)) store.reports = [current, ...store.reports].slice(0, 50);
  store.current = null;
  saveStore(store);
  projectEl.value = '';
  dateEl.value = localDate();
  reportEmployees = [];
  renderReportEmployees();
  positionsEl.innerHTML = '';
  addPosition();
  signatureData = '';
  resizeCanvas(false);
  updateAllPositionTotals();
  renderHistory();
}

async function printReport() {
  const data = reportData();
  if (!data.project) { projectEl.focus(); alert('Bitte zuerst den Projektnamen eintragen.'); return; }
  const meaningful = data.positions.filter(isMeaningful);
  if (!meaningful.length) { alert('Bitte mindestens eine Tätigkeitsposition eintragen.'); return; }
  const missingAssignments = meaningful.some(position => position.description && !position.assignments.length && !position.legacyHours);
  if (missingAssignments) { alert('Bitte jeder Tätigkeitsposition mindestens einen Mitarbeiter mit Stunden zuordnen.'); return; }
  const rows = meaningful.map((position, index) => {
    const assigned = position.assignments.length
      ? position.assignments.map(assignment => `<span class="pdf-assignment"><strong>${escapeHtml(assignment.name)}</strong> · ${escapeHtml(assignment.role)} · ${formatHours(assignment.hours)} Std.</span>`).join('')
      : '<span class="pdf-assignment">Nicht zugeordnet</span>';
    return `<tr><td>${index + 1}</td><td>${escapeHtml(position.description).replace(/\n/g, '<br>')}</td><td>${assigned}</td><td>${formatHours(employeeHours(position))}</td></tr>`;
  }).join('');
  const employees = data.employees.length ? data.employees.map(employee => `${escapeHtml(employee.name)} (${escapeHtml(employee.role)})`).join(' · ') : 'Keine Mitarbeiter ausgewählt';
  const signature = data.signature ? `<img class="pdf-signature" src="${data.signature}" alt="Unterschrift Dawid Glenc">` : '<span class="signature-placeholder">Nicht unterschrieben</span>';
  $('#print-root').innerHTML = `<section class="pdf-page"><header class="pdf-head"><img class="pdf-logo" src="${new URL('assets/logo.png', document.baseURI).href}" alt="Glenc Innenausbau GmbH"><div class="pdf-company"><strong>${COMPANY.name}</strong><br>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}<br>USt-IdNr. ${COMPANY.vat}</div></header><p class="pdf-document-type">Leistungsnachweis</p><h1 class="pdf-title">Regiebericht</h1><div class="pdf-meta"><div><b>Projekt</b>${escapeHtml(data.project)}</div><div><b>Datum</b>${formatDate(data.date)}</div></div><div class="pdf-employees"><b>Mitarbeiter im Bericht</b>${employees}</div><table class="pdf-table"><thead><tr><th>Pos.</th><th>Tätigkeitsbeschreibung</th><th>Mitarbeitereinsatz</th><th>Stunden</th></tr></thead><tbody>${rows}</tbody></table><div class="pdf-total"><span>Gesamtstunden</span><strong>${formatHours(totalHours(meaningful))} Std.</strong></div><div class="pdf-sign-block"><div class="pdf-sign-box">${signature}</div><small>Unterschrift Dawid Glenc</small></div><footer class="pdf-footer"><span>${COMPANY.name}</span><span>Regiebericht · ${escapeHtml(data.project)}</span></footer></section>`;
  const logo = $('#print-root .pdf-logo');
  if (!logo.complete || !logo.naturalWidth) await new Promise(resolve => { logo.addEventListener('load', resolve, { once: true }); logo.addEventListener('error', resolve, { once: true }); });
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const oldTitle = document.title;
  const safeProject = data.project.replace(/[^a-z0-9]+/gi, '_').slice(0, 80) || 'Projekt';
  document.title = `Regiebericht_${safeProject}_${data.date || localDate()}`;
  window.print();
  document.title = oldTitle;
}

$('#add-position').addEventListener('click', () => { addPosition(); positionsEl.lastElementChild.querySelector('textarea').focus(); });
$('#add-employee').addEventListener('click', addEmployee);
employeeNameEl.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addEmployee(); } });
$('#new-report').addEventListener('click', newReport);
$('#create-pdf').addEventListener('click', printReport);
[projectEl, dateEl].forEach(control => control.addEventListener('input', saveCurrent));
dateEl.value = localDate();
resizeCanvas(false);
renderEmployeeManager();
renderReportEmployees();
addPosition();
const current = getStore().current;
if (current) loadReport(current, false);
renderHistory();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(() => {}));
}
