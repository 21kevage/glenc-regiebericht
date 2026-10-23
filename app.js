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
function safeFilePart(value) { return String(value || 'Projekt').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Projekt'; }
function showStatus(message, duration = 3600) {
  statusEl.textContent = message;
  if (duration) window.setTimeout(() => { if (statusEl.textContent === message) statusEl.textContent = 'Entwurf bereit'; }, duration);
}
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

function pdfLine(pdf, x, y, width, label, value) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(102, 95, 87);
  pdf.text(label.toUpperCase(), x, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(33, 27, 20);
  const lines = pdf.splitTextToSize(value || '–', width);
  pdf.text(lines, x, y + 5);
  return lines.length * 4.4 + 8;
}

async function assetAsDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Asset konnte nicht geladen werden: ${path}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function blobAsBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function downloadPdf(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

async function saveNativePdf(blob, fileName) {
  const filesystem = window.Capacitor?.Plugins?.Filesystem;
  const share = window.Capacitor?.Plugins?.Share;
  if (!filesystem?.writeFile || !share?.share) throw new Error('Die Android-Speicherfunktion ist in dieser APK nicht verfügbar.');
  showStatus('PDF wird gespeichert …', 0);
  const result = await filesystem.writeFile({
    path: fileName,
    data: await blobAsBase64(blob),
    directory: 'CACHE',
    recursive: false
  });
  await share.share({
    title: 'Glenc Regiebericht',
    text: fileName,
    files: [result.uri],
    dialogTitle: 'Regiebericht speichern oder teilen'
  });
  showStatus('PDF erstellt – Ziel auswählen', 4600);
}

async function createPdf() {
  const data = reportData();
  if (!data.project) { projectEl.focus(); alert('Bitte zuerst den Projektnamen eintragen.'); return; }
  const meaningful = data.positions.filter(isMeaningful);
  if (!meaningful.length) { alert('Bitte mindestens eine Tätigkeitsposition eintragen.'); return; }
  const missingAssignments = meaningful.some(position => position.description && !position.assignments.length && !position.legacyHours);
  if (missingAssignments) { alert('Bitte jeder Tätigkeitsposition mindestens einen Mitarbeiter mit Stunden zuordnen.'); return; }
  const button = $('#create-pdf');
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'PDF wird erstellt …';
  try {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('Die PDF-Bibliothek konnte nicht geladen werden.');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 15;
    const logoData = await assetAsDataUrl('assets/logo.png');
    pdf.addImage(logoData, 'PNG', margin, y, 67, 22);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(33, 27, 20);
    pdf.text(COMPANY.name, pageWidth - margin, y + 3, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(94, 87, 79);
    [COMPANY.address, COMPANY.phone, COMPANY.email, `USt-IdNr. ${COMPANY.vat}`].forEach((line, index) => pdf.text(line, pageWidth - margin, y + 8 + index * 4, { align: 'right' }));
    y += 28;
    pdf.setDrawColor(200, 144, 20);
    pdf.setLineWidth(0.9);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(168, 117, 11);
    pdf.text('LEISTUNGSNACHWEIS', margin, y);
    y += 8;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(33, 27, 20);
    pdf.text('Regiebericht', margin, y);
    y += 9;
    pdf.setFillColor(246, 242, 234);
    pdf.rect(margin, y, contentWidth, 22, 'F');
    const projectHeight = pdfLine(pdf, margin + 5, y + 5, 83, 'Projekt', data.project);
    const dateHeight = pdfLine(pdf, margin + 102, y + 5, 75, 'Datum', formatDate(data.date));
    y += Math.max(22, projectHeight + 4, dateHeight + 4) + 7;
    const employeeText = data.employees.length ? data.employees.map(employee => `${employee.name} (${employee.role})`).join(' · ') : 'Keine Mitarbeiter ausgewählt';
    pdf.setFillColor(250, 247, 240);
    const employeeLines = pdf.splitTextToSize(employeeText, contentWidth - 10);
    const employeeHeight = Math.max(13, employeeLines.length * 4.5 + 10);
    pdf.rect(margin, y, contentWidth, employeeHeight, 'F');
    pdf.setDrawColor(200, 144, 20);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, margin, y + employeeHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(102, 95, 87);
    pdf.text('MITARBEITER IM BERICHT', margin + 5, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(33, 27, 20);
    pdf.text(employeeLines, margin + 5, y + 10);
    y += employeeHeight + 7;

    const drawTableHeader = () => {
      pdf.setFillColor(36, 30, 22);
      pdf.rect(margin, y, contentWidth, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text('POS.', margin + 3, y + 5);
      pdf.text('TÄTIGKEITSBESCHREIBUNG', margin + 15, y + 5);
      pdf.text('MITARBEITEREINSATZ', margin + 92, y + 5);
      pdf.text('STD.', pageWidth - margin - 3, y + 5, { align: 'right' });
      y += 8;
    };
    drawTableHeader();
    meaningful.forEach((position, index) => {
      const description = pdf.splitTextToSize(position.description || '–', 70);
      const assignmentText = position.assignments.length
        ? position.assignments.map(assignment => `${assignment.name} · ${assignment.role} · ${formatHours(assignment.hours)} Std.`)
        : ['Nicht zugeordnet'];
      const assignments = assignmentText.flatMap(item => pdf.splitTextToSize(item, 64));
      const rowHeight = Math.max(12, description.length * 4.2 + 6, assignments.length * 4.2 + 6);
      if (y + rowHeight > pageHeight - 30) {
        pdf.addPage();
        y = 18;
        drawTableHeader();
      }
      pdf.setDrawColor(217, 209, 196);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(33, 27, 20);
      pdf.text(String(index + 1), margin + 5, y + 6, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.3);
      pdf.text(description, margin + 15, y + 6);
      pdf.setFontSize(7.7);
      pdf.text(assignments, margin + 92, y + 6);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.text(`${formatHours(employeeHours(position))}`, pageWidth - margin - 3, y + 6, { align: 'right' });
      y += rowHeight;
    });
    if (y + 50 > pageHeight - 18) { pdf.addPage(); y = 18; }
    y += 8;
    pdf.setDrawColor(36, 30, 22);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(33, 27, 20);
    pdf.text('Gesamtstunden', pageWidth - margin - 42, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(`${formatHours(totalHours(meaningful))} Std.`, pageWidth - margin, y, { align: 'right' });
    y += 21;
    pdf.setDrawColor(117, 109, 99);
    pdf.setLineWidth(0.25);
    pdf.line(margin, y + 22, margin + 68, y + 22);
    if (data.signature) {
      try { pdf.addImage(data.signature, 'PNG', margin, y, 64, 20); } catch { /* A corrupt legacy signature must not prevent PDF creation. */ }
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(94, 87, 79);
    pdf.text('Unterschrift Dawid Glenc', margin, y + 27);
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(217, 209, 196);
      pdf.setLineWidth(0.2);
      pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      pdf.setTextColor(102, 95, 87);
      pdf.text(COMPANY.name, margin, pageHeight - 8);
      pdf.text(`Regiebericht · ${data.project}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
    const blob = pdf.output('blob');
    const fileName = `Regiebericht_${safeFilePart(data.project)}_${data.date || localDate()}.pdf`;
    if (isNativeApp()) await saveNativePdf(blob, fileName);
    else {
      downloadPdf(blob, fileName);
      showStatus('PDF wurde heruntergeladen');
    }
  } catch (error) {
    console.error('PDF export failed', error);
    showStatus('PDF-Erstellung fehlgeschlagen', 5200);
    alert(`Die PDF konnte nicht erstellt werden. ${error?.message || 'Bitte erneut versuchen.'}`);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

$('#add-position').addEventListener('click', () => { addPosition(); positionsEl.lastElementChild.querySelector('textarea').focus(); });
$('#add-employee').addEventListener('click', addEmployee);
employeeNameEl.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addEmployee(); } });
$('#new-report').addEventListener('click', newReport);
$('#create-pdf').addEventListener('click', createPdf);
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
