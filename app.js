const STORAGE_KEY = "estroktor-control-registros-v1";
const PROJECT_KEY = "estroktor-control-proyectos-v1";
const API_STATE_URL = "/api/state";
const PROCESS_RENAMES = {
  "Inspección de soldadura": "Visual",
  "Visual y dimensional": "Dimensional"
};

const DEFAULT_PROJECTS = [
  { key: "EZ", name: "Estacionamiento Zumaya" },
  { key: "AN", name: "Ampliacion Nave" },
  { key: "71+780", name: "Puente KM 71+780" },
  { key: "66+900", name: "Puente KM 66+900" },
  { key: "64+820", name: "Puente KM 64+820" },
  { key: "50D", name: "50 Doctors" }
];

const state = {
  records: [],
  projects: DEFAULT_PROJECTS,
  selectedType: "inspeccion",
  pendingDelete: null,
  sharedMode: false,
  syncError: false
};

const els = {
  form: document.querySelector("#record-form"),
  recordId: document.querySelector("#record-id"),
  tabs: document.querySelectorAll(".type-tab"),
  project: document.querySelector("#project"),
  piece: document.querySelector("#piece"),
  startAt: document.querySelector("#start-at"),
  endAt: document.querySelector("#end-at"),
  process: document.querySelector("#process"),
  repairReason: document.querySelector("#repair-reason"),
  welder: document.querySelector("#welder"),
  assembler: document.querySelector("#assembler"),
  inspector: document.querySelector("#inspector"),
  joints: document.querySelector("#joints"),
  brand: document.querySelector("#brand"),
  status: document.querySelector("#status"),
  notes: document.querySelector("#notes"),
  resetForm: document.querySelector("#reset-form"),
  saveAndClose: document.querySelector("#save-and-close"),
  startButtons: document.querySelectorAll("[data-start-type]"),
  openList: document.querySelector("#open-list"),
  recordList: document.querySelector("#record-list"),
  search: document.querySelector("#search"),
  filterType: document.querySelector("#filter-type"),
  filterStatus: document.querySelector("#filter-status"),
  filterFrom: document.querySelector("#filter-from"),
  filterTo: document.querySelector("#filter-to"),
  exportCsv: document.querySelector("#export-csv"),
  exportJson: document.querySelector("#export-json"),
  projectForm: document.querySelector("#project-form"),
  projectKey: document.querySelector("#project-key"),
  projectName: document.querySelector("#project-name"),
  projectList: document.querySelector("#project-list"),
  metricTotal: document.querySelector("#metric-total"),
  metricInspection: document.querySelector("#metric-inspection"),
  metricReinspection: document.querySelector("#metric-reinspection"),
  metricRepair: document.querySelector("#metric-repair"),
  metricOpen: document.querySelector("#metric-open"),
  metricToday: document.querySelector("#metric-today"),
  dialog: document.querySelector("#confirm-dialog"),
  dialogMessage: document.querySelector("#dialog-message")
};

init();

async function init() {
  state.records = migrateRecords(load(STORAGE_KEY, []));
  state.projects = load(PROJECT_KEY, DEFAULT_PROJECTS);
  await loadSharedState();
  renderProjects();
  resetForm();
  bindEvents();
  render();
  registerServiceWorker();
  window.setInterval(refreshSharedState, 7000);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setType(tab.dataset.type));
  });

  els.startButtons.forEach((button) => {
    button.addEventListener("click", () => {
      resetForm();
      setType(button.dataset.startType);
      els.startAt.value = toLocalInputValue(new Date());
      window.scrollTo({ top: document.querySelector(".panel-form").offsetTop - 12, behavior: "smooth" });
      els.piece.focus();
    });
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRecord(false);
  });

  els.saveAndClose.addEventListener("click", () => saveRecord(true));
  els.resetForm.addEventListener("click", resetForm);

  [els.search, els.filterType, els.filterStatus, els.filterFrom, els.filterTo].forEach((input) => {
    input.addEventListener("input", renderLists);
  });

  els.exportCsv.addEventListener("click", exportCsv);
  els.exportJson.addEventListener("click", exportJson);

  els.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const key = els.projectKey.value.trim().toUpperCase();
    const name = els.projectName.value.trim();
    if (!key || !name) return;

    const existing = state.projects.find((project) => project.key === key);
    if (existing) {
      existing.name = name;
    } else {
      state.projects.push({ key, name });
    }
    persistProjects();
    els.projectForm.reset();
    renderProjects();
  });

  els.dialog.addEventListener("close", () => {
    if (els.dialog.returnValue === "confirm" && state.pendingDelete) {
      state.records = state.records.filter((record) => record.id !== state.pendingDelete);
      state.pendingDelete = null;
      persistRecords();
      render();
    }
  });
}

function setType(type) {
  state.selectedType = type;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.type === type));

  const isRepair = type === "reparacion";
  document.querySelectorAll(".field-inspection").forEach((field) => field.classList.toggle("hidden", isRepair));
  document.querySelectorAll(".field-repair").forEach((field) => field.classList.toggle("hidden", !isRepair));
}

function resetForm() {
  els.form.reset();
  els.recordId.value = "";
  els.startAt.value = toLocalInputValue(new Date());
  els.endAt.value = "";
  els.status.value = "abierto";
  setType(state.selectedType || "inspeccion");
}

function saveRecord(closeNow) {
  const id = els.recordId.value || createId();
  const startAt = new Date(els.startAt.value);
  const status = closeNow ? "cerrado" : els.status.value;
  const endAtValue = closeNow
    ? new Date()
    : (status === "cerrado" && els.endAt.value ? new Date(els.endAt.value) : null);

  if (endAtValue && endAtValue < startAt) {
    alert("La hora de fin no puede ser menor que la hora de inicio.");
    return;
  }

  const record = {
    id,
    type: state.selectedType,
    projectKey: els.project.value,
    projectName: projectName(els.project.value),
    piece: clean(els.piece.value),
    startAt: startAt.toISOString(),
    endAt: status === "cerrado" && endAtValue ? endAtValue.toISOString() : "",
    status,
    process: clean(els.process.value),
    repairReason: clean(els.repairReason.value),
    welder: clean(els.welder.value),
    assembler: clean(els.assembler.value),
    inspector: clean(els.inspector.value),
    joints: clean(els.joints.value),
    brand: clean(els.brand.value),
    notes: clean(els.notes.value),
    updatedAt: new Date().toISOString()
  };

  const index = state.records.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.records[index] = record;
  } else {
    state.records.unshift(record);
  }

  persistRecords();
  resetForm();
  render();
}

function render() {
  renderMetrics();
  renderLists();
}

function renderProjects() {
  els.project.innerHTML = state.projects
    .map((project) => `<option value="${escapeHtml(project.key)}">${escapeHtml(project.key)} - ${escapeHtml(project.name)}</option>`)
    .join("");

  els.projectList.innerHTML = state.projects
    .map((project) => `
      <div class="project-chip">
        <span><strong>${escapeHtml(project.key)}</strong> ${escapeHtml(project.name)}</span>
        <button class="icon-btn" type="button" title="Quitar proyecto" data-project-remove="${escapeHtml(project.key)}">x</button>
      </div>
    `)
    .join("");

  document.querySelectorAll("[data-project-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.projectRemove;
      state.projects = state.projects.filter((project) => project.key !== key);
      persistProjects();
      renderProjects();
    });
  });
}

function renderMetrics() {
  const today = new Date();
  els.metricTotal.textContent = state.records.length;
  els.metricInspection.textContent = state.records.filter((record) => record.type === "inspeccion").length;
  els.metricReinspection.textContent = state.records.filter((record) => record.type === "reinspeccion").length;
  els.metricRepair.textContent = state.records.filter((record) => record.type === "reparacion").length;
  els.metricOpen.textContent = state.records.filter((record) => record.status === "abierto").length;
  els.metricToday.textContent = state.records.filter((record) => sameDay(new Date(record.startAt), today)).length;
}

function renderLists() {
  const openRecords = state.records
    .filter((record) => record.status === "abierto")
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt));

  els.openList.innerHTML = openRecords.map(recordCard).join("");

  const filtered = filteredRecords();
  els.recordList.innerHTML = filtered.map(recordCard).join("");

  bindRecordButtons();
}

function filteredRecords() {
  const query = clean(els.search.value).toLowerCase();
  const type = els.filterType.value;
  const status = els.filterStatus.value;
  const from = els.filterFrom.value ? new Date(`${els.filterFrom.value}T00:00:00`) : null;
  const to = els.filterTo.value ? new Date(`${els.filterTo.value}T23:59:59`) : null;

  return state.records.filter((record) => {
    const date = new Date(record.startAt);
    const haystack = [
      record.type,
      record.projectKey,
      record.projectName,
      record.piece,
      record.process,
      record.repairReason,
      record.welder,
      record.assembler,
      record.inspector,
      record.brand,
      record.notes
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query))
      && (!type || record.type === type)
      && (!status || record.status === status)
      && (!from || date >= from)
      && (!to || date <= to);
  });
}

function recordCard(record) {
  const isRepair = record.type === "reparacion";
  const roleLabel = "Nombre de colaborador";
  const people = isRepair ? record.assembler : record.welder;
  const mainWork = isRepair ? record.repairReason : record.process;

  return `
    <article class="record-card ${escapeHtml(record.type)}">
      <div>
        <p class="record-title">
          <span>${typeLabel(record.type)} ${escapeHtml(record.projectKey)} - ${escapeHtml(record.piece)}</span>
          <span class="badge ${record.status === "abierto" ? "open" : "closed"}">${record.status}</span>
          <span class="badge">${formatDuration(durationMinutes(record))}</span>
        </p>
        <dl class="record-meta">
          <div><strong>Proyecto:</strong> ${escapeHtml(record.projectName)}</div>
          <div><strong>Trabajo:</strong> ${escapeHtml(mainWork || "Sin detalle")}</div>
          <div><strong>${roleLabel}:</strong> ${escapeHtml(people || "No capturado")}</div>
          <div><strong>Inspector:</strong> ${escapeHtml(record.inspector || "No capturado")}</div>
          <div><strong>Inicio:</strong> ${formatDate(record.startAt)} <strong>Fin:</strong> ${record.endAt ? formatDate(record.endAt) : "Pendiente"}</div>
          ${record.joints ? `<div><strong>Juntas:</strong> ${escapeHtml(record.joints)}</div>` : ""}
          ${record.brand ? `<div><strong>Marca/consumible:</strong> ${escapeHtml(record.brand)}</div>` : ""}
          ${record.notes ? `<div><strong>Notas:</strong> ${escapeHtml(record.notes)}</div>` : ""}
        </dl>
      </div>
      <div class="card-actions">
        ${record.status === "abierto" ? `<button class="icon-btn" type="button" title="Cerrar ahora" data-close="${record.id}">✓</button>` : ""}
        <button class="icon-btn" type="button" title="Editar" data-edit="${record.id}">✎</button>
        <button class="icon-btn" type="button" title="Duplicar" data-copy="${record.id}">⧉</button>
        <button class="icon-btn" type="button" title="Eliminar" data-delete="${record.id}">x</button>
      </div>
    </article>
  `;
}

function bindRecordButtons() {
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = findRecord(button.dataset.close);
      if (!record) return;
      record.endAt = new Date().toISOString();
      record.status = "cerrado";
      record.updatedAt = new Date().toISOString();
      persistRecords();
      render();
    });
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editRecord(button.dataset.edit));
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyRecord(button.dataset.copy));
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => confirmDelete(button.dataset.delete));
  });
}

function editRecord(id) {
  const record = findRecord(id);
  if (!record) return;

  setType(record.type);
  els.recordId.value = record.id;
  els.project.value = record.projectKey;
  els.piece.value = record.piece;
  els.startAt.value = toLocalInputValue(new Date(record.startAt));
  els.endAt.value = record.endAt ? toLocalInputValue(new Date(record.endAt)) : "";
  els.process.value = record.process || els.process.options[0].value;
  els.repairReason.value = record.repairReason || "";
  els.welder.value = record.welder || "";
  els.assembler.value = record.assembler || "";
  els.inspector.value = record.inspector || "";
  els.joints.value = record.joints || "";
  els.brand.value = record.brand || "";
  els.status.value = record.status || "abierto";
  els.notes.value = record.notes || "";
  window.scrollTo({ top: document.querySelector(".panel-form").offsetTop - 12, behavior: "smooth" });
}

function copyRecord(id) {
  const record = findRecord(id);
  if (!record) return;

  setType(record.type);
  els.recordId.value = "";
  els.project.value = record.projectKey;
  els.piece.value = record.piece;
  els.startAt.value = toLocalInputValue(new Date());
  els.endAt.value = "";
  els.process.value = record.process || els.process.options[0].value;
  els.repairReason.value = record.repairReason || "";
  els.welder.value = record.welder || "";
  els.assembler.value = record.assembler || "";
  els.inspector.value = record.inspector || "";
  els.joints.value = record.joints || "";
  els.brand.value = record.brand || "";
  els.status.value = "abierto";
  els.notes.value = record.notes || "";
  window.scrollTo({ top: document.querySelector(".panel-form").offsetTop - 12, behavior: "smooth" });
}

function confirmDelete(id) {
  state.pendingDelete = id;
  const record = findRecord(id);
  els.dialogMessage.textContent = `Se eliminara ${typeLabel(record.type)} ${record.projectKey} - ${record.piece}.`;
  els.dialog.showModal();
}

function exportCsv() {
  const headers = [
    "tipo",
    "estado",
    "proyecto_clave",
    "proyecto",
    "pieza",
    "inicio",
    "fin",
    "duracion_min",
    "proceso",
    "motivo_reparacion",
    "nombre_colaborador",
    "nombre_colaborador_reparacion",
    "inspector",
    "juntas",
    "marca_consumible",
    "observaciones"
  ];

  const rows = filteredRecords().map((record) => [
    typeLabel(record.type),
    record.status,
    record.projectKey,
    record.projectName,
    record.piece,
    formatDate(record.startAt),
    record.endAt ? formatDate(record.endAt) : "",
    durationMinutes(record),
    record.process,
    record.repairReason,
    record.welder,
    record.assembler,
    record.inspector,
    record.joints,
    record.brand,
    record.notes
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`control-retrabajos-${dateStamp()}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    projects: state.projects,
    records: state.records
  };
  downloadFile(`respaldo-control-retrabajos-${dateStamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function load(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function persistRecords() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  } catch {
    alert("No se pudieron guardar los datos en este navegador. Revise que no este en modo privado o sin espacio.");
  }
  persistSharedState();
}

function persistProjects() {
  try {
    window.localStorage.setItem(PROJECT_KEY, JSON.stringify(state.projects));
  } catch {
    alert("No se pudieron guardar los proyectos en este navegador. Revise que no este en modo privado o sin espacio.");
  }
  persistSharedState();
}

async function loadSharedState() {
  if (!canUseSharedServer()) {
    return;
  }

  try {
    const response = await fetch(API_STATE_URL, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    state.records = migrateRecords(data.records);
    state.projects = Array.isArray(data.projects) && data.projects.length ? data.projects : DEFAULT_PROJECTS;
    state.sharedMode = true;
    state.syncError = false;
  } catch {
    state.syncError = true;
  }
}

async function refreshSharedState() {
  const activeElement = document.activeElement;
  const editingForm = activeElement && typeof activeElement.closest === "function" && activeElement.closest("#record-form");
  if (!state.sharedMode || editingForm) {
    return;
  }

  await loadSharedState();
  renderProjects();
  render();
}

async function persistSharedState() {
  if (!canUseSharedServer()) {
    return;
  }

  try {
    const response = await fetch(API_STATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: state.records,
        projects: state.projects
      })
    });

    if (!response.ok) {
      throw new Error("No se pudo guardar");
    }

    state.sharedMode = true;
    state.syncError = false;
  } catch {
    state.syncError = true;
    alert("No se pudo guardar en la base compartida. Revise que la ventana del servidor siga abierta en la computadora.");
  }
}

function canUseSharedServer() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function migrateRecords(records) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.map((record) => ({
    ...record,
    process: PROCESS_RENAMES[record.process] || record.process
  }));
}

function createId() {
  const cryptoApi = window.crypto || window.msCrypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `rec-${Date.now()}-${randomPart}`;
}

function findRecord(id) {
  return state.records.find((record) => record.id === id);
}

function projectName(key) {
  const project = state.projects.find((item) => item.key === key);
  return project ? project.name : key;
}

function typeLabel(type) {
  return {
    inspeccion: "Inspección",
    reinspeccion: "Reinspección",
    reparacion: "Reparación"
  }[type] || type;
}

function clean(value) {
  return String(value || "").trim();
}

function durationMinutes(record) {
  const start = new Date(record.startAt);
  const end = record.endAt ? new Date(record.endAt) : new Date();
  return Math.max(0, Math.round((end - start) / 60000));
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function toLocalInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function csvCell(value) {
  return `"${String(value == null ? "" : value).replace(/"/g, "\"\"")}"`;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js")
      .then((registration) => registration.update())
      .catch(() => {});
  }
}
