const STORAGE_KEY = 'desktop-notes:v3';
const V2_STORAGE_KEY = 'sprout-notes:v2';
const V1_STORAGE_KEY = 'sprout-deskbar:v1';
const THEMES = ['gray', 'paper', 'graphite', 'glass', 'editorial', 'wabi'];
const THEME_ALIASES = {
  ivory: 'gray',
  obsidian: 'graphite',
  smoke: 'glass',
  classic: 'paper',
};
const EDITORIAL_THEMES = new Set(['editorial', 'wabi']);
const SCHEDULE_MODES = ['datetime', 'date', 'time', 'none'];
const MAX_ITEMS = 100;
const MAX_BODY_LENGTH = 1000;
const EDITOR_MIN_HEIGHT = 22;
const EDITOR_MAX_HEIGHT = 40;
const STAGING_EDITOR_MIN_HEIGHT = 18;
const STAGING_EDITOR_MAX_HEIGHT = 36;
const MAX_STAGING_TEXT_LENGTH = 5000;

const bridge = window.desktopNotes ?? {
  getWindowState: async () => ({
    dockedEdge: null,
    pinned: true,
    shortcutRegistered: false,
    size: { width: 420, height: 340 },
    sizeLimits: { minWidth: 320, maxWidth: 640, minHeight: 280, maxHeight: 640 },
  }),
  setPinned: async (pinned) => ({ dockedEdge: null, pinned }),
  setWindowSize: async (size) => ({ dockedEdge: null, pinned: true, size }),
  restoreFromEdge: async () => ({ dockedEdge: null, pinned: true }),
  hide: async () => true,
  getLaunchAtLogin: async () => ({ supported: false, enabled: false }),
  setLaunchAtLogin: async () => ({ supported: false, enabled: false }),
  listStaging: async () => ({ ok: true, items: [], limits: {} }),
  createStagingText: async () => ({ ok: false, error: '暂存功能不可用' }),
  updateStagingText: async () => ({ ok: false, error: '暂存功能不可用' }),
  reorderStaging: async () => ({ ok: false, error: '暂存功能不可用' }),
  deleteStagingItem: async () => ({ ok: false, error: '暂存功能不可用' }),
  clearStaging: async () => ({ ok: false, error: '暂存功能不可用' }),
  importStagingFiles: async () => ({ ok: false, error: '暂存功能不可用' }),
  importStagingPaths: async () => ({ ok: false, error: '暂存功能不可用' }),
  getPathForFile: () => '',
  openStagingFile: async () => ({ ok: false, error: '暂存功能不可用' }),
  chooseStagingImages: async () => ({ ok: false, error: '暂存功能不可用' }),
  pasteToStaging: async () => ({ ok: false, error: '暂存功能不可用' }),
  copyStagingItem: async () => ({ ok: false, error: '暂存功能不可用' }),
  saveStagingImage: async () => ({ ok: false, error: '暂存功能不可用' }),
  openStagingPreview: async () => ({ ok: false, error: '预览不可用' }),
  closeStagingPreview: async () => true,
  showStagingHover: async () => ({ ok: false, error: '侧边预览不可用' }),
  hideStagingHover: async () => true,
  showStagingContextMenu: async () => ({ ok: false, canceled: true }),
  onWindowStateChanged: () => () => {},
  onCreateItemRequested: () => () => {},
};

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 20;
const DEFAULT_APPEARANCE = {
  theme: 'gray',
  opacity: 92,
  fontSize: 13,
};

function resolveTheme(theme) {
  const mapped = THEME_ALIASES[theme] ?? theme;
  return THEMES.includes(mapped) ? mapped : DEFAULT_APPEARANCE.theme;
}

function normalizeAppearance(appearance) {
  return {
    theme: resolveTheme(appearance?.theme),
    opacity: clamp(appearance?.opacity, 50, 100, DEFAULT_APPEARANCE.opacity),
    fontSize: clamp(appearance?.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_APPEARANCE.fontSize),
  };
}

function currentFontSize() {
  return clamp(state.appearance?.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_APPEARANCE.fontSize);
}

function scaledSize(base) {
  return Math.round(base * currentFontSize() / DEFAULT_APPEARANCE.fontSize);
}

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function normalizeSchedule(schedule) {
  const mode = SCHEDULE_MODES.includes(schedule?.mode) ? schedule.mode : 'none';
  if (mode === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(schedule?.value ?? '')) {
    return { mode, value: schedule.value };
  }
  if (mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(schedule?.value ?? '')) {
    return { mode, value: schedule.value };
  }
  if (mode === 'time' && /^\d{2}:\d{2}$/.test(schedule?.value ?? '')) {
    return { mode, value: schedule.value };
  }
  return { mode: 'none', value: '' };
}

function normalizeItem(item, index) {
  if (!item || typeof item.body !== 'string') return null;
  const createdAt = Number.isFinite(item.createdAt) ? item.createdAt : Date.now() - index;
  return {
    id: String(item.id ?? createId()),
    body: item.body.slice(0, MAX_BODY_LENGTH),
    schedule: normalizeSchedule(item.schedule),
    createdAt,
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : createdAt,
    done: Boolean(item.done),
  };
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function loadState() {
  const saved = readJson(STORAGE_KEY);
  if (saved && Array.isArray(saved.items)) {
    return {
      items: saved.items.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS),
      appearance: normalizeAppearance(saved.appearance),
      workspace: saved.workspace === 'staging' ? 'staging' : 'items',
    };
  }

  const v2 = readJson(V2_STORAGE_KEY);
  if (v2 && Array.isArray(v2.notes)) {
    return {
      items: v2.notes.map((note, index) => normalizeItem({ ...note, schedule: { mode: 'none', value: '' } }, index)).filter(Boolean),
      appearance: { ...DEFAULT_APPEARANCE },
      workspace: 'items',
    };
  }

  const v1 = readJson(V1_STORAGE_KEY);
  if (typeof v1?.note === 'string' && v1.note.trim()) {
    const now = Date.now();
    return {
      items: [{
        id: createId(),
        body: v1.note.slice(0, MAX_BODY_LENGTH),
        schedule: { mode: 'none', value: '' },
        createdAt: now,
        updatedAt: now,
      }],
      appearance: { ...DEFAULT_APPEARANCE },
      workspace: 'items',
    };
  }

  return { items: [], appearance: { ...DEFAULT_APPEARANCE }, workspace: 'items' };
}

let state = loadState();
let windowState = {
  dockedEdge: null,
  edgePreviewed: false,
  pinned: true,
  shortcutRegistered: false,
    size: { width: 420, height: 340 },
    sizeLimits: { minWidth: 320, maxWidth: 640, minHeight: 280, maxHeight: 640 },
};
let activeScheduleItemId = null;
let calendarView = { year: new Date().getFullYear(), month: new Date().getMonth() };
let draggedItemId = null;
let draggedStagingItemId = null;
let stagingDragDepth = 0;
let toastTimer = null;
let dateRefreshTimer = null;
let launchAtLoginRequestId = 0;
let launchAtLoginState = {
  supported: true,
  enabled: false,
  busy: true,
  error: null,
};
const deleteConfirmTimers = new Map();
const stagingDeleteConfirmTimers = new Map();
const stagingTextSaveTimers = new Map();
let clearStagingConfirmTimer = null;
let stagingState = {
  items: [],
  loaded: false,
  limits: { maxItems: 200, maxTextLength: MAX_STAGING_TEXT_LENGTH, maxImageBytes: 30 * 1024 * 1024 },
};

const elements = {
  app: document.querySelector('#app'),
  itemsList: document.querySelector('#itemsList'),
  itemsWorkspace: document.querySelector('#itemsWorkspace'),
  itemTemplate: document.querySelector('#itemTemplate'),
  stagingItemTemplate: document.querySelector('#stagingItemTemplate'),
  stagingWorkspace: document.querySelector('#stagingWorkspace'),
  stagingList: document.querySelector('#stagingList'),
  stagingEmpty: document.querySelector('#stagingEmpty'),
  stagingCount: document.querySelector('#stagingCount'),
  itemsTab: document.querySelector('#itemsTab'),
  stagingTab: document.querySelector('#stagingTab'),
  todayDate: document.querySelector('#todayDate'),
  itemCount: document.querySelector('#itemCount'),
  addItem: document.querySelector('#addItem'),
  addStaging: document.querySelector('#addStaging'),
  emptyState: document.querySelector('#emptyState'),
  pasteStaging: document.querySelector('#pasteStaging'),
  clearStaging: document.querySelector('#clearStaging'),
  settingsButton: document.querySelector('#settingsButton'),
  settingsPanel: document.querySelector('#settingsPanel'),
  settingsContent: document.querySelector('.settings-content'),
  hideButton: document.querySelector('#hideButton'),
  pinButton: document.querySelector('#pinButton'),
  sortByTimeButton: document.querySelector('#sortByTimeButton'),
  closeButton: document.querySelector('#closeButton'),
  itemComposerInput: document.querySelector('#itemComposerInput'),
  edgeHandle: document.querySelector('#edgeHandle'),
  themeChoices: [...document.querySelectorAll('[data-theme-choice]')],
  opacityInput: document.querySelector('#opacityInput'),
  opacityValue: document.querySelector('#opacityValue'),
  fontSizeInput: document.querySelector('#fontSizeInput'),
  fontSizeValue: document.querySelector('#fontSizeValue'),
  widthInput: document.querySelector('#widthInput'),
  heightInput: document.querySelector('#heightInput'),
  applySize: document.querySelector('#applySize'),
  pinToggle: document.querySelector('#pinToggle'),
  launchAtLoginToggle: document.querySelector('#launchAtLoginToggle'),
  launchAtLoginHint: document.querySelector('#launchAtLoginHint'),
  schedulePanel: document.querySelector('#schedulePanel'),
  dropOverlay: document.querySelector('#dropOverlay'),
  datetimeDateInput: document.querySelector('#datetimeDateInput'),
  datePickerButton: document.querySelector('#datePickerButton'),
  datePickerLabel: document.querySelector('#datePickerLabel'),
  datePickerPanel: document.querySelector('#datePickerPanel'),
  datePickerMonth: document.querySelector('#datePickerMonth'),
  datePickerDays: document.querySelector('#datePickerDays'),
  datePickerPrev: document.querySelector('#datePickerPrev'),
  datePickerNext: document.querySelector('#datePickerNext'),
  clearDate: document.querySelector('#clearDate'),
  timeTextInput: document.querySelector('#timeTextInput'),
  timePickerPanel: document.querySelector('#timePickerPanel'),
  timeHourList: document.querySelector('#timeHourList'),
  timeMinuteList: document.querySelector('#timeMinuteList'),
  clearTime: document.querySelector('#clearTime'),
  saveSchedule: document.querySelector('#saveSchedule'),
  closePanelButtons: [...document.querySelectorAll('[data-close-panel]')],
  toast: document.querySelector('#toast'),
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyAppearance() {
  const fontSize = currentFontSize();
  state.appearance.fontSize = fontSize;
  elements.app.dataset.theme = state.appearance.theme;
  elements.app.dataset.layout = EDITORIAL_THEMES.has(state.appearance.theme) ? 'editorial' : 'compact';
  elements.app.style.setProperty('--panel-alpha', (state.appearance.opacity / 100).toFixed(2));
  elements.app.style.setProperty('--font-size', `${fontSize}px`);
  elements.opacityInput.value = String(state.appearance.opacity);
  elements.opacityValue.value = `${state.appearance.opacity}%`;
  elements.opacityValue.textContent = `${state.appearance.opacity}%`;
  elements.fontSizeInput.value = String(fontSize);
  elements.fontSizeValue.value = `${fontSize}px`;
  elements.fontSizeValue.textContent = `${fontSize}px`;
  for (const choice of elements.themeChoices) {
    const active = choice.dataset.themeChoice === state.appearance.theme;
    choice.classList.toggle('is-active', active);
    choice.setAttribute('aria-checked', String(active));
  }
  for (const editor of document.querySelectorAll('.item-editor')) fitEditorHeight(editor);
  for (const editor of document.querySelectorAll('.staging-text-editor')) fitStagingEditorHeight(editor);
}

function formatHeaderDate(date = new Date()) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function updateHeaderDate(date = new Date()) {
  const displayDate = formatHeaderDate(date);
  elements.todayDate.textContent = displayDate;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  elements.todayDate.dateTime = `${year}-${month}-${day}`;
  return displayDate;
}

function startHeaderDateClock() {
  clearInterval(dateRefreshTimer);
  updateHeaderDate();
  dateRefreshTimer = setInterval(updateHeaderDate, 60_000);
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 1500);
}

function applyLaunchAtLoginState(nextState) {
  launchAtLoginState = {
    ...launchAtLoginState,
    ...nextState,
    busy: Boolean(nextState?.busy),
  };
  elements.launchAtLoginToggle.checked = Boolean(launchAtLoginState.enabled);
  elements.launchAtLoginToggle.disabled = launchAtLoginState.busy || !launchAtLoginState.supported;

  if (launchAtLoginState.busy) {
    elements.launchAtLoginHint.textContent = '正在读取系统状态';
  } else if (!launchAtLoginState.supported) {
    elements.launchAtLoginHint.textContent = '当前系统不支持此功能';
  } else if (launchAtLoginState.error) {
    elements.launchAtLoginHint.textContent = launchAtLoginState.error;
  } else if (launchAtLoginState.enabled) {
    elements.launchAtLoginHint.textContent = '已开启 · 登录 Windows 后自动打开';
  } else {
    elements.launchAtLoginHint.textContent = '默认关闭 · 可随时开启';
  }
}

async function refreshLaunchAtLogin() {
  const requestId = ++launchAtLoginRequestId;
  if (!launchAtLoginState.loaded) applyLaunchAtLoginState({ busy: true });
  try {
    const result = await bridge.getLaunchAtLogin();
    if (requestId !== launchAtLoginRequestId) return launchAtLoginState;
    applyLaunchAtLoginState({ ...result, loaded: true, busy: false, error: result.error ?? null });
  } catch {
    if (requestId !== launchAtLoginRequestId) return launchAtLoginState;
    applyLaunchAtLoginState({
      supported: true,
      enabled: false,
      loaded: true,
      busy: false,
      error: '无法读取开机自启动状态',
    });
  }
  return launchAtLoginState;
}

async function updateLaunchAtLogin(enabled) {
  const requestId = ++launchAtLoginRequestId;
  const previousEnabled = launchAtLoginState.enabled;
  applyLaunchAtLoginState({ enabled: Boolean(enabled), busy: true, error: null });
  try {
    const result = await bridge.setLaunchAtLogin(Boolean(enabled));
    if (requestId !== launchAtLoginRequestId) return launchAtLoginState;
    applyLaunchAtLoginState({ ...result, loaded: true, busy: false, error: result.error ?? null });
    if (result.error) {
      showToast(result.error);
    } else {
      showToast(result.enabled ? '已开启开机自启动' : '已关闭开机自启动');
    }
  } catch {
    if (requestId !== launchAtLoginRequestId) return launchAtLoginState;
    applyLaunchAtLoginState({
      enabled: previousEnabled,
      loaded: true,
      busy: false,
      error: '无法修改开机自启动设置',
    });
    showToast('无法修改开机自启动设置');
  }
  return launchAtLoginState;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function todayIsoDate(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function formatPickerDate(iso) {
  if (!iso) return '不设置';
  const [year, month, day] = iso.split('-');
  return `${year}/${month}/${day}`;
}

function parseIsoDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month: month - 1, day };
}

function normalizeDirectTime(value) {
  const input = String(value ?? '').trim().replace(/[：.]/g, ':');
  let hour;
  let minute;
  if (/^\d{3,4}$/.test(input)) {
    hour = input.length === 3 ? input.slice(0, 1) : input.slice(0, 2);
    minute = input.slice(-2);
  } else {
    const match = input.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    [, hour, minute] = match;
  }
  const hours = Number(hour);
  const minutes = Number(minute);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

function clearTimeInputError() {
  elements.timeTextInput.classList.remove('is-invalid');
  elements.timeTextInput.removeAttribute('aria-invalid');
}

function markTimeInputError() {
  elements.timeTextInput.classList.add('is-invalid');
  elements.timeTextInput.setAttribute('aria-invalid', 'true');
  elements.timeTextInput.focus();
  elements.timeTextInput.select();
}

function formatSchedule(schedule, now = new Date()) {
  if (schedule.mode === 'datetime' && schedule.value) {
    const [, timePart = ''] = schedule.value.split('T');
    return { main: timePart.slice(0, 5), kind: 'time' };
  }
  if (schedule.mode === 'time' && schedule.value) {
    return { main: schedule.value, kind: 'time' };
  }
  if (schedule.mode === 'date' && schedule.value) {
    const [year, month, day] = schedule.value.split('-').map(Number);
    const isToday = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();
    return { main: isToday ? '今天' : `${month}月${day}日`, kind: 'date' };
  }
  return { main: '', kind: 'none' };
}

function fitEditorHeight(editor) {
  const minHeight = scaledSize(EDITOR_MIN_HEIGHT);
  const maxHeight = scaledSize(EDITOR_MAX_HEIGHT);
  editor.style.height = `${minHeight}px`;
  const requiredHeight = editor.scrollHeight;
  const nextHeight = Math.min(Math.max(requiredHeight, minHeight), maxHeight);
  editor.style.height = `${nextHeight}px`;
  editor.classList.toggle('is-scrollable', requiredHeight > maxHeight);
}

function fitStagingEditorHeight(editor) {
  const minHeight = scaledSize(STAGING_EDITOR_MIN_HEIGHT);
  const maxHeight = scaledSize(STAGING_EDITOR_MAX_HEIGHT);
  editor.style.height = `${minHeight}px`;
  const requiredHeight = editor.scrollHeight;
  const nextHeight = Math.min(Math.max(requiredHeight, minHeight), maxHeight);
  editor.style.height = `${nextHeight}px`;
  editor.classList.toggle('is-scrollable', requiredHeight > maxHeight);
}

function formatStagingTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatBytes(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function formatRelativeTime(timestamp, now = Date.now()) {
  const delta = Math.max(0, now - Number(timestamp || now));
  if (delta < 60_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}小时前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatStagingMeta(item) {
  const relative = formatRelativeTime(item.createdAt);
  if (item.type === 'image') return `${item.format} · ${formatBytes(item.bytes)} · ${relative}`;
  if (item.type === 'file') {
    const kind = (item.extension || '文件').replace(/^\./, '').toUpperCase() || '文件';
    return `${item.exists === false ? '已丢失 · ' : ''}${kind} · ${formatBytes(item.bytes)} · ${relative}`;
  }
  return `文字 · ${Array.from(item.text ?? '').length}字 · ${relative}`;
}

function formatStagingTag(item) {
  if (item.type === 'file') return item.exists === false ? '丢失' : '文件';
  if (item.type !== 'image') return '文字';
  return /截图|screenshot/i.test(item.name ?? '') ? '截图' : '图片';
}

function updateWorkspaceTabs() {
  const stagingCount = stagingState.items.length;
  elements.itemCount.textContent = String(state.items.length);
  elements.stagingCount.textContent = String(stagingCount);
  elements.itemsTab.setAttribute('aria-label', `待办 ${state.items.length} 条`);
  elements.stagingTab.setAttribute('aria-label', `暂存 ${stagingCount} 项`);
  elements.stagingEmpty.hidden = stagingCount !== 0;
  elements.clearStaging.hidden = stagingCount === 0;
}

function setActiveWorkspace(workspace, { persist = true } = {}) {
  const nextWorkspace = workspace === 'staging' ? 'staging' : 'items';
  state.workspace = nextWorkspace;
  const stagingActive = nextWorkspace === 'staging';
  elements.itemsWorkspace.hidden = stagingActive;
  elements.stagingWorkspace.hidden = !stagingActive;
  elements.itemsTab.classList.toggle('is-active', !stagingActive);
  elements.stagingTab.classList.toggle('is-active', stagingActive);
  elements.itemsTab.setAttribute('aria-selected', String(!stagingActive));
  elements.stagingTab.setAttribute('aria-selected', String(stagingActive));
  if (persist) saveState();
  updateWorkspaceTabs();
  if (!stagingActive) void bridge.hideStagingHover();
}

function applyStagingSnapshot(result) {
  if (!result?.ok || !Array.isArray(result.items)) return false;
  stagingState = {
    items: result.items.filter((item) => item && ['text', 'image', 'file'].includes(item.type)),
    loaded: true,
    limits: { ...stagingState.limits, ...(result.limits ?? {}) },
  };
  renderStagingItems();
  updateWorkspaceTabs();
  return true;
}

async function refreshStaging() {
  const result = await bridge.listStaging();
  if (!applyStagingSnapshot(result) && result?.error) showToast(result.error);
  return result;
}

function updateItemCount() {
  elements.emptyState.hidden = state.items.length !== 0;
  updateWorkspaceTabs();
}

function closePanels({ closePreview = true } = {}) {
  resetSettingsScroll();
  closeSchedulePickers();
  elements.settingsPanel.hidden = true;
  elements.schedulePanel.hidden = true;
  elements.dropOverlay.hidden = true;
  stagingDragDepth = 0;
  activeScheduleItemId = null;
  if (closePreview) {
    void bridge.closeStagingPreview();
    void bridge.hideStagingHover();
  }
}

function resetSettingsScroll() {
  elements.settingsPanel.scrollTop = 0;
  elements.settingsContent.scrollTop = 0;
  showSettingsSection('appearance');
}

function showSettingsSection(section) {
  const target = section === 'behavior' || section === 'about' ? section : 'appearance';
  const element = document.querySelector(`#settings${target[0].toUpperCase()}${target.slice(1)}`);
  element?.scrollIntoView({ block: 'start' });
}

function closeSchedulePickers() {
  const dateOpen = !elements.datePickerPanel.hidden;
  const timeOpen = !elements.timePickerPanel.hidden;
  elements.datePickerPanel.hidden = true;
  elements.timePickerPanel.hidden = true;
  elements.datePickerButton.setAttribute('aria-expanded', 'false');
  return dateOpen || timeOpen;
}

function syncDatePicker() {
  const value = elements.datetimeDateInput.value;
  const empty = !value;
  elements.datePickerLabel.textContent = formatPickerDate(value);
  elements.datePickerButton.classList.toggle('is-empty', empty);
  elements.datePickerButton.setAttribute('aria-label', empty ? '日期，不设置' : `日期，${formatPickerDate(value)}`);
}

function renderDatePicker() {
  elements.datePickerMonth.textContent = `${calendarView.year}年${calendarView.month + 1}月`;
  const days = elements.datePickerDays;
  while (days.firstChild) days.removeChild(days.firstChild);
  const firstWeekday = new Date(calendarView.year, calendarView.month, 1).getDay();
  const daysInMonth = new Date(calendarView.year, calendarView.month + 1, 0).getDate();
  const selected = elements.datetimeDateInput.value;
  const today = todayIsoDate();
  for (let index = 0; index < firstWeekday; index += 1) {
    const spacer = document.createElement('span');
    spacer.className = 'calendar-spacer';
    days.append(spacer);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${calendarView.year}-${pad2(calendarView.month + 1)}-${pad2(day)}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(day);
    if (iso === selected) button.classList.add('is-selected');
    if (iso === today) button.classList.add('is-today');
    button.addEventListener('click', () => {
      elements.datetimeDateInput.value = iso;
      syncDatePicker();
      closeSchedulePickers();
    });
    days.append(button);
  }
}

function openDatePicker() {
  elements.timePickerPanel.hidden = true;
  const parsed = parseIsoDate(elements.datetimeDateInput.value) ?? parseIsoDate(todayIsoDate());
  calendarView = { year: parsed.year, month: parsed.month };
  renderDatePicker();
  elements.datePickerPanel.hidden = false;
  elements.datePickerButton.setAttribute('aria-expanded', 'true');
}

function currentTimeParts() {
  const normalized = normalizeDirectTime(elements.timeTextInput.value);
  if (!normalized) return { hour: null, minute: null };
  const [hour, minute] = normalized.split(':').map(Number);
  return { hour, minute };
}

function highlightTimePicker() {
  const { hour, minute } = currentTimeParts();
  for (const button of elements.timeHourList.children) {
    button.classList.toggle('is-selected', Number(button.dataset.hour) === hour);
  }
  for (const button of elements.timeMinuteList.children) {
    button.classList.toggle('is-selected', Number(button.dataset.minute) === minute);
  }
}

function selectTimePart(part, value) {
  let { hour, minute } = currentTimeParts();
  if (part === 'hour') hour = value;
  else minute = value;
  if (hour == null) hour = 0;
  if (minute == null) minute = 0;
  elements.timeTextInput.value = `${pad2(hour)}:${pad2(minute)}`;
  clearTimeInputError();
  highlightTimePicker();
}

function buildTimePickerColumns() {
  if (elements.timeHourList.childElementCount) return;
  for (let hour = 0; hour < 24; hour += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.hour = String(hour);
    button.textContent = pad2(hour);
    button.addEventListener('click', () => selectTimePart('hour', hour));
    elements.timeHourList.append(button);
  }
  for (let minute = 0; minute < 60; minute += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.minute = String(minute);
    button.textContent = pad2(minute);
    button.addEventListener('click', () => selectTimePart('minute', minute));
    elements.timeMinuteList.append(button);
  }
}

function openTimePicker() {
  elements.datePickerPanel.hidden = true;
  elements.datePickerButton.setAttribute('aria-expanded', 'false');
  buildTimePickerColumns();
  highlightTimePicker();
  elements.timePickerPanel.hidden = false;
  requestAnimationFrame(() => {
    elements.timeHourList.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
    elements.timeMinuteList.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  });
}

function openSchedule(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  void bridge.closeStagingPreview();
  elements.settingsPanel.hidden = true;
  activeScheduleItemId = itemId;
  let scheduledDate = '';
  let scheduledTime = '';
  if (item.schedule.mode === 'datetime') {
    [scheduledDate = '', scheduledTime = ''] = item.schedule.value.split('T');
  } else if (item.schedule.mode === 'date') {
    scheduledDate = item.schedule.value;
  } else if (item.schedule.mode === 'time') {
    scheduledTime = item.schedule.value;
  }
  elements.datetimeDateInput.value = scheduledDate;
  elements.timeTextInput.value = scheduledTime.slice(0, 5);
  clearTimeInputError();
  syncDatePicker();
  closeSchedulePickers();
  elements.schedulePanel.hidden = false;
}

function updateSchedule(itemId, schedule) {
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return false;
  item.schedule = normalizeSchedule(schedule);
  item.updatedAt = Date.now();
  saveState();
  renderItems();
  return true;
}

function moveItem(itemId, targetIndex) {
  const fromIndex = state.items.findIndex((item) => item.id === itemId);
  if (fromIndex < 0) return false;
  const [item] = state.items.splice(fromIndex, 1);
  const boundedTarget = Math.min(Math.max(targetIndex, 0), state.items.length);
  state.items.splice(boundedTarget, 0, item);
  saveState();
  renderItems();
  return true;
}

function clearDropMarkers() {
  for (const row of document.querySelectorAll('.item-row, .staging-row')) {
    row.classList.remove('is-drop-before', 'is-drop-after');
  }
}

function scheduleSortKey(schedule, now = new Date()) {
  const normalized = normalizeSchedule(schedule);
  if (normalized.mode === 'datetime') {
    const stamp = Date.parse(`${normalized.value}:00`);
    return Number.isFinite(stamp) ? stamp : Number.POSITIVE_INFINITY;
  }
  if (normalized.mode === 'date') {
    const stamp = Date.parse(`${normalized.value}T00:00:00`);
    return Number.isFinite(stamp) ? stamp : Number.POSITIVE_INFINITY;
  }
  if (normalized.mode === 'time') {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const stamp = Date.parse(`${today}T${normalized.value}:00`);
    return Number.isFinite(stamp) ? stamp : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function sortOpenItemsByTime() {
  const now = new Date();
  const open = state.items.filter((item) => !item.done);
  const closed = state.items.filter((item) => item.done);
  open.sort((first, second) => {
    const delta = scheduleSortKey(first.schedule, now) - scheduleSortKey(second.schedule, now);
    return delta !== 0 ? delta : first.createdAt - second.createdAt;
  });
  state.items = [...open, ...closed];
  saveState();
  renderItems();
  showToast('已按时间排序未完成待办');
  return true;
}

function setItemDone(itemId, done) {
  const current = state.items.find((candidate) => candidate.id === itemId);
  if (!current || Boolean(current.done) === Boolean(done)) return false;
  current.done = Boolean(done);
  current.updatedAt = Date.now();
  const open = state.items.filter((item) => !item.done);
  const closed = state.items.filter((item) => item.done);
  state.items = [...open, ...closed];
  saveState();
  renderItems();
  return true;
}

function deleteItem(itemId) {
  clearTimeout(deleteConfirmTimers.get(itemId));
  deleteConfirmTimers.delete(itemId);
  const previousLength = state.items.length;
  state.items = state.items.filter((candidate) => candidate.id !== itemId);
  if (state.items.length === previousLength) return false;
  saveState();
  renderItems();
  showToast('待办已删除');
  return true;
}

function buildItemRow(item) {
  const fragment = elements.itemTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.item-row');
  const handle = fragment.querySelector('.reorder-handle');
  const doneInput = fragment.querySelector('.item-done');
  const editor = fragment.querySelector('.item-editor');
  const scheduleButton = fragment.querySelector('.schedule-button');
  const timeMain = fragment.querySelector('.time-main');
  const deleteButton = fragment.querySelector('.delete-button');
  const time = formatSchedule(item.schedule);

  row.dataset.itemId = item.id;
  row.classList.toggle('is-done', Boolean(item.done));
  doneInput.checked = Boolean(item.done);
  doneInput.setAttribute('aria-label', item.done ? `标记未完成：${item.body.slice(0, 24) || '空白待办'}` : `标记完成：${item.body.slice(0, 24) || '空白待办'}`);
  editor.value = item.body;
  editor.setAttribute('aria-label', `编辑待办：${item.body.slice(0, 24) || '空白待办'}`);
  timeMain.textContent = time.main;
  scheduleButton.dataset.mode = item.schedule.mode;
  scheduleButton.classList.toggle('has-time', item.schedule.mode !== 'none');
  scheduleButton.classList.toggle('is-date', time.kind === 'date');
  scheduleButton.setAttribute('aria-label', item.schedule.mode === 'none' ? '设置时间' : `修改时间：${time.main}`);
  scheduleButton.title = item.schedule.mode === 'none' ? '设置时间' : `修改时间：${time.main}`;

  editor.addEventListener('input', () => {
    fitEditorHeight(editor);
    const current = state.items.find((candidate) => candidate.id === item.id);
    if (!current) return;
    current.body = editor.value.slice(0, MAX_BODY_LENGTH);
    current.updatedAt = Date.now();
    saveState();
  });
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') createItem();
  });
  doneInput.addEventListener('click', (event) => event.stopPropagation());
  doneInput.addEventListener('change', () => {
    setItemDone(item.id, doneInput.checked);
  });

  scheduleButton.addEventListener('click', () => openSchedule(item.id));

  deleteButton.addEventListener('click', () => {
    const current = state.items.find((candidate) => candidate.id === item.id);
    if (current && !current.body.trim()) {
      deleteItem(item.id);
      return;
    }
    if (deleteButton.classList.contains('is-confirming')) {
      deleteItem(item.id);
      return;
    }
    deleteButton.classList.add('is-confirming');
    deleteButton.setAttribute('aria-label', '再次点击确认删除');
    deleteConfirmTimers.set(item.id, setTimeout(() => {
      deleteButton.classList.remove('is-confirming');
      deleteButton.setAttribute('aria-label', '删除待办');
    }, 1900));
  });

  handle.addEventListener('dragstart', (event) => {
    draggedItemId = item.id;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
  });
  handle.addEventListener('dragend', () => {
    draggedItemId = null;
    row.classList.remove('is-dragging');
    clearDropMarkers();
  });
  handle.addEventListener('keydown', (event) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const index = state.items.findIndex((candidate) => candidate.id === item.id);
    moveItem(item.id, event.key === 'ArrowUp' ? index - 1 : index + 1);
    requestAnimationFrame(() => document.querySelector(`[data-item-id="${item.id}"] .reorder-handle`)?.focus());
  });

  row.addEventListener('dragover', (event) => {
    if (!draggedItemId || draggedItemId === item.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropMarkers();
    const before = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
    row.classList.add(before ? 'is-drop-before' : 'is-drop-after');
  });
  row.addEventListener('drop', (event) => {
    if (!draggedItemId || draggedItemId === item.id) return;
    event.preventDefault();
    const sourceId = draggedItemId;
    const before = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
    const targetIndex = state.items.findIndex((candidate) => candidate.id === item.id);
    const sourceIndex = state.items.findIndex((candidate) => candidate.id === sourceId);
    let insertionIndex = before ? targetIndex : targetIndex + 1;
    if (sourceIndex < insertionIndex) insertionIndex -= 1;
    moveItem(sourceId, insertionIndex);
    clearDropMarkers();
  });

  return { fragment, editor };
}

function renderItems({ focusId = null } = {}) {
  elements.itemsList.replaceChildren();
  updateItemCount();
  let editorToFocus = null;
  for (const item of state.items) {
    const { fragment, editor } = buildItemRow(item);
    elements.itemsList.append(fragment);
    fitEditorHeight(editor);
    if (item.id === focusId) editorToFocus = editor;
  }
  if (editorToFocus) {
    requestAnimationFrame(() => {
      editorToFocus.focus();
      editorToFocus.setSelectionRange(editorToFocus.value.length, editorToFocus.value.length);
      editorToFocus.closest('.item-row').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

async function persistStagingText(itemId, value) {
  clearTimeout(stagingTextSaveTimers.get(itemId));
  stagingTextSaveTimers.delete(itemId);
  const result = await bridge.updateStagingText(itemId, value.slice(0, MAX_STAGING_TEXT_LENGTH));
  if (!result?.ok) {
    showToast(result?.error ?? '暂存文字保存失败');
    return false;
  }
  const saved = result.item;
  const localItem = stagingState.items.find((item) => item.id === itemId);
  if (localItem && saved?.updatedAt) localItem.updatedAt = saved.updatedAt;
  return true;
}

function queueStagingTextSave(itemId, value) {
  clearTimeout(stagingTextSaveTimers.get(itemId));
  stagingTextSaveTimers.set(itemId, setTimeout(() => {
    void persistStagingText(itemId, value);
  }, 260));
}

async function copyStaging(itemId) {
  const result = await bridge.copyStagingItem(itemId);
  showToast(result?.ok ? '已复制到剪贴板' : (result?.error ?? '复制失败'));
  return Boolean(result?.ok);
}

async function saveStagingImage(itemId) {
  const result = await bridge.saveStagingImage(itemId);
  if (result?.canceled) return false;
  const okMessage = result?.type === 'file' ? '文件副本已保存' : result?.type === 'text' ? '文字已保存' : '图片已保存';
  showToast(result?.ok ? okMessage : (result?.error ?? '保存失败'));
  return Boolean(result?.ok);
}

async function openStagingItemPreview(itemId) {
  const item = stagingState.items.find((candidate) => candidate.id === itemId);
  if (!item) return false;
  void bridge.hideStagingHover();
  closePanels({ closePreview: false });
  if (item.type === 'file') {
    const result = await bridge.openStagingFile(item.id);
    if (!result?.ok) showToast(result?.error ?? '无法打开文件');
    else if (result.blocked) showToast('已在文件夹中显示，未直接运行该文件');
    return Boolean(result?.ok);
  }
  const result = await bridge.openStagingPreview(item.id);
  if (!result?.ok) showToast(result?.error ?? '无法打开预览');
  return Boolean(result?.ok);
}

async function openStagingContextMenu(itemId) {
  const result = await bridge.showStagingContextMenu(itemId);
  if (!result || result.canceled) return false;
  if (result.action === 'delete') {
    if (!applyStagingSnapshot(result)) {
      showToast(result.error ?? '删除暂存项失败');
      return false;
    }
    showToast('暂存项已删除');
    return true;
  }
  if (result.action === 'copy') {
    showToast(result.ok ? '已复制到剪贴板' : (result.error ?? '复制失败'));
    return Boolean(result.ok);
  }
  if (result.action === 'save') {
    if (!result.canceled) showToast(result.ok ? '暂存内容已保存' : (result.error ?? '保存失败'));
    return Boolean(result.ok);
  }
  if (result.action === 'open' && result.blocked) showToast('已在文件夹中显示，未直接运行该文件');
  if ((result.action === 'preview' || result.action === 'open' || result.action === 'reveal') && !result.ok) {
    showToast(result.error ?? '无法打开文件');
  }
  return Boolean(result.ok);
}

async function removeStagingItem(itemId) {
  clearTimeout(stagingDeleteConfirmTimers.get(itemId));
  stagingDeleteConfirmTimers.delete(itemId);
  const result = await bridge.deleteStagingItem(itemId);
  if (!applyStagingSnapshot(result)) {
    showToast(result?.error ?? '删除暂存项失败');
    return false;
  }
  showToast('暂存项已删除');
  return true;
}

async function moveStagingItem(itemId, targetIndex) {
  const fromIndex = stagingState.items.findIndex((item) => item.id === itemId);
  if (fromIndex < 0) return false;
  const [item] = stagingState.items.splice(fromIndex, 1);
  const boundedTarget = Math.min(Math.max(targetIndex, 0), stagingState.items.length);
  stagingState.items.splice(boundedTarget, 0, item);
  renderStagingItems();
  const result = await bridge.reorderStaging(stagingState.items.map((candidate) => candidate.id));
  if (!result?.ok) {
    showToast(result?.error ?? '暂存排序保存失败');
    await refreshStaging();
    return false;
  }
  applyStagingSnapshot(result);
  return true;
}

function getElementLocalRect(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function isPointerInsideElement(element, event) {
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom;
}

function buildStagingItemRow(item) {
  const fragment = elements.stagingItemTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.staging-row');
  const handle = fragment.querySelector('.staging-reorder');
  const visual = fragment.querySelector('.staging-visual');
  const thumbnail = fragment.querySelector('.staging-thumbnail');
  const imageName = fragment.querySelector('.staging-image-name');
  const textEditor = fragment.querySelector('.staging-text-editor');
  const tag = fragment.querySelector('.staging-tag');
  const meta = fragment.querySelector('.staging-meta');
  const copyButton = fragment.querySelector('.staging-copy');
  const saveButton = fragment.querySelector('.staging-save');
  const previewButton = fragment.querySelector('.staging-preview');
  const deleteButton = fragment.querySelector('.staging-delete');

  row.dataset.stagingId = item.id;
  row.dataset.kind = item.type;
  tag.textContent = formatStagingTag(item);
  meta.textContent = formatStagingMeta(item);
  handle.setAttribute('aria-label', `拖动调整暂存顺序：${item.type === 'text' ? item.text.slice(0, 20) : item.name}`);
  visual.setAttribute(
    'aria-label',
    item.type === 'image'
      ? `预览图片：${item.name}`
      : item.type === 'file'
        ? `打开文件：${item.name}`
        : `预览文字：${item.text.slice(0, 24) || '空白内容'}`,
  );
  visual.addEventListener('pointerenter', () => {
    void bridge.showStagingHover(item.id, getElementLocalRect(visual));
  });
  visual.addEventListener('pointerleave', (event) => {
    if (event.relatedTarget && visual.contains(event.relatedTarget)) return;
    if (isPointerInsideElement(visual, event)) return;
    void bridge.hideStagingHover();
  });
  visual.addEventListener('click', () => void openStagingItemPreview(item.id));

  if (item.type === 'image') {
    thumbnail.src = item.thumbnailUrl;
    thumbnail.alt = '';
    imageName.textContent = item.name;
    meta.textContent = formatStagingMeta(item);
  } else if (item.type === 'file') {
    const mark = fragment.querySelector('.staging-text-mark');
    const ext = (item.extension || '').replace(/^\./, '').slice(0, 4).toUpperCase() || 'FILE';
    mark.textContent = ext;
    imageName.textContent = item.name;
    row.classList.toggle('is-missing', item.exists === false);
  } else {
    textEditor.value = item.text;
    textEditor.setAttribute('aria-label', `编辑暂存文字：${item.text.slice(0, 24) || '空白内容'}`);
    textEditor.addEventListener('input', () => {
      fitStagingEditorHeight(textEditor);
      const current = stagingState.items.find((candidate) => candidate.id === item.id);
      if (!current) return;
      current.text = textEditor.value.slice(0, MAX_STAGING_TEXT_LENGTH);
      queueStagingTextSave(item.id, current.text);
    });
    textEditor.addEventListener('blur', () => {
      if (stagingTextSaveTimers.has(item.id)) void persistStagingText(item.id, textEditor.value);
    });
  }

  copyButton.addEventListener('click', () => void copyStaging(item.id));
  previewButton.addEventListener('click', () => void openStagingItemPreview(item.id));
  saveButton.addEventListener('click', () => void saveStagingImage(item.id));
  deleteButton.addEventListener('click', () => {
    if (deleteButton.classList.contains('is-confirming')) {
      void removeStagingItem(item.id);
      return;
    }
    deleteButton.classList.add('is-confirming');
    deleteButton.setAttribute('aria-label', '再次点击确认删除');
    stagingDeleteConfirmTimers.set(item.id, setTimeout(() => {
      deleteButton.classList.remove('is-confirming');
      deleteButton.setAttribute('aria-label', '删除暂存项');
    }, 1900));
  });

  visual.draggable = true;
  visual.addEventListener('dragstart', (event) => {
    draggedStagingItemId = item.id;
    row.classList.add('is-dragging');
    void bridge.hideStagingHover();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
  });
  visual.addEventListener('dragend', () => {
    draggedStagingItemId = null;
    row.classList.remove('is-dragging');
    clearDropMarkers();
  });
  handle.addEventListener('dragstart', (event) => {
    draggedStagingItemId = item.id;
    row.classList.add('is-dragging');
    void bridge.hideStagingHover();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
  });
  handle.addEventListener('dragend', () => {
    draggedStagingItemId = null;
    row.classList.remove('is-dragging');
    clearDropMarkers();
  });
  handle.addEventListener('keydown', (event) => {
    if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const index = stagingState.items.findIndex((candidate) => candidate.id === item.id);
    void moveStagingItem(item.id, event.key === 'ArrowUp' ? index - 1 : index + 1).then(() => {
      requestAnimationFrame(() => document.querySelector(`[data-staging-id="${item.id}"] .staging-reorder`)?.focus());
    });
  });

  row.addEventListener('dragover', (event) => {
    if (!draggedStagingItemId || draggedStagingItemId === item.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropMarkers();
    const before = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
    row.classList.add(before ? 'is-drop-before' : 'is-drop-after');
  });
  row.addEventListener('drop', (event) => {
    if (!draggedStagingItemId || draggedStagingItemId === item.id) return;
    event.preventDefault();
    const sourceId = draggedStagingItemId;
    const before = event.clientY < row.getBoundingClientRect().top + row.offsetHeight / 2;
    const targetIndex = stagingState.items.findIndex((candidate) => candidate.id === item.id);
    const sourceIndex = stagingState.items.findIndex((candidate) => candidate.id === sourceId);
    let insertionIndex = before ? targetIndex : targetIndex + 1;
    if (sourceIndex < insertionIndex) insertionIndex -= 1;
    void moveStagingItem(sourceId, insertionIndex);
    clearDropMarkers();
  });
  row.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    void openStagingContextMenu(item.id);
  });

  return { fragment, textEditor };
}

function renderStagingItems({ focusId = null } = {}) {
  elements.stagingList.replaceChildren();
  let editorToFocus = null;
  for (const item of stagingState.items) {
    const { fragment, textEditor } = buildStagingItemRow(item);
    elements.stagingList.append(fragment);
    if (item.type === 'text') fitStagingEditorHeight(textEditor);
    if (item.id === focusId && item.type === 'text') editorToFocus = textEditor;
  }
  updateWorkspaceTabs();
  if (editorToFocus) {
    requestAnimationFrame(() => {
      editorToFocus.focus();
      editorToFocus.setSelectionRange(editorToFocus.value.length, editorToFocus.value.length);
      editorToFocus.closest('.staging-row').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

async function createStagingText(text = '', { focus = true } = {}) {
  closePanels();
  const result = await bridge.createStagingText(String(text).slice(0, MAX_STAGING_TEXT_LENGTH));
  if (!applyStagingSnapshot(result)) {
    showToast(result?.error ?? '无法新建暂存文字');
    return null;
  }
  setActiveWorkspace('staging');
  if (focus && result.item?.id) renderStagingItems({ focusId: result.item.id });
  return result.item?.id ?? null;
}

function reportStagingImport(result) {
  if (result?.canceled) return false;
  if (!applyStagingSnapshot(result)) {
    showToast(result?.error ?? '暂存导入失败');
    return false;
  }
  closePanels();
  setActiveWorkspace('staging');
  showToast(result.warning ?? `已暂存 ${result.imported ?? 1} 项`);
  return true;
}

async function chooseStagingImages() {
  return reportStagingImport(await bridge.chooseStagingImages());
}

async function pasteCurrentClipboard() {
  return reportStagingImport(await bridge.pasteToStaging());
}

async function importStagingFileObjects(fileList) {
  const files = [...(fileList ?? [])].slice(0, 20);
  if (!files.length) {
    showToast('请拖入文件或图片');
    return false;
  }
  const paths = [];
  const payloads = [];
  for (const file of files) {
    const filePath = bridge.getPathForFile?.(file) || file.path || '';
    if (filePath) {
      paths.push(filePath);
      continue;
    }
    if (file.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      try {
        payloads.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      } catch {
        showToast(`${file.name || '图片'} 读取失败`);
      }
    }
  }
  if (paths.length) return reportStagingImport(await bridge.importStagingPaths(paths));
  if (payloads.length) return reportStagingImport(await bridge.importStagingFiles(payloads));
  showToast('请拖入本地文件或图片');
  return false;
}

async function clearAllStaging() {
  if (!elements.clearStaging.classList.contains('is-confirming')) {
    elements.clearStaging.classList.add('is-confirming');
    elements.clearStaging.textContent = '再次点击清空';
    clearTimeout(clearStagingConfirmTimer);
    clearStagingConfirmTimer = setTimeout(() => {
      elements.clearStaging.classList.remove('is-confirming');
      elements.clearStaging.textContent = '清空';
    }, 2200);
    return false;
  }
  clearTimeout(clearStagingConfirmTimer);
  elements.clearStaging.classList.remove('is-confirming');
  elements.clearStaging.textContent = '清空';
  const result = await bridge.clearStaging();
  if (!applyStagingSnapshot(result)) {
    showToast(result?.error ?? '无法清空暂存区');
    return false;
  }
  closePanels();
  showToast(`已清空 ${result.removed ?? 0} 项`);
  return true;
}

function createItem(body = '', schedule = { mode: 'none', value: '' }) {
  if (state.items.length >= MAX_ITEMS) {
    showToast(`最多保存 ${MAX_ITEMS} 条待办`);
    return null;
  }
  closePanels();
  const now = Date.now();
  const item = {
    id: createId(),
    body: String(body).slice(0, MAX_BODY_LENGTH),
    schedule: normalizeSchedule(schedule),
    done: false,
    createdAt: now,
    updatedAt: now,
  };
  state.items.unshift(item);
  saveState();
  renderItems({ focusId: item.id });
  return item.id;
}

function setTheme(theme) {
  const resolved = resolveTheme(theme);
  if (!THEMES.includes(resolved)) return false;
  state.appearance.theme = resolved;
  saveState();
  applyAppearance();
  return true;
}

function setOpacity(opacity) {
  state.appearance.opacity = clamp(opacity, 50, 100, DEFAULT_APPEARANCE.opacity);
  saveState();
  applyAppearance();
}

function setFontSize(fontSize) {
  state.appearance.fontSize = clamp(fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, DEFAULT_APPEARANCE.fontSize);
  saveState();
  applyAppearance();
}

function openSettings() {
  void bridge.closeStagingPreview();
  elements.schedulePanel.hidden = true;
  activeScheduleItemId = null;
  elements.widthInput.value = String(windowState.size.width);
  elements.heightInput.value = String(windowState.size.height);
  elements.pinToggle.checked = windowState.pinned;
  applyAppearance();
  resetSettingsScroll();
  elements.settingsPanel.hidden = false;
  requestAnimationFrame(resetSettingsScroll);
  void refreshLaunchAtLogin();
}

function applyWindowState(nextState) {
  windowState = { ...windowState, ...nextState };
  const edge = windowState.dockedEdge ?? '';
  const previewed = Boolean(edge && windowState.edgePreviewed);
  const hiddenAtEdge = Boolean(edge) && !previewed;
  if (hiddenAtEdge) {
    closePanels();
    elements.toast.classList.remove('is-visible');
  }
  elements.app.dataset.edge = edge;
  elements.app.classList.toggle('is-edge-hidden', hiddenAtEdge);
  elements.app.classList.toggle('is-edge-preview', previewed);
  elements.pinToggle.checked = windowState.pinned;
  elements.pinButton.classList.toggle('is-pinned', Boolean(windowState.pinned));
  elements.pinButton.setAttribute('aria-pressed', String(Boolean(windowState.pinned)));
  if (windowState.size) {
    elements.widthInput.value = String(windowState.size.width);
    elements.heightInput.value = String(windowState.size.height);
  }
}

async function hideToTray() {
  elements.app.classList.add('is-hiding');
  setTimeout(async () => {
    await bridge.hide();
    elements.app.classList.remove('is-hiding');
  }, 150);
}

function targetAcceptsTextInput(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'color', 'file', 'radio', 'range', 'submit'].includes(target.type);
}

function dragContainsFiles(event) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

function hideDropOverlay() {
  stagingDragDepth = 0;
  elements.dropOverlay.hidden = true;
}

function bindEvents() {
  elements.addItem.addEventListener('click', () => {
    const body = elements.itemComposerInput.value.trim();
    if (body) {
      createItem(body);
      elements.itemComposerInput.value = '';
      return;
    }
    elements.itemComposerInput.focus();
  });
  elements.itemComposerInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const body = elements.itemComposerInput.value.trim();
    if (!body) return;
    createItem(body);
    elements.itemComposerInput.value = '';
  });
  elements.addStaging.addEventListener('click', () => void chooseStagingImages());
  elements.itemsTab.addEventListener('click', () => {
    closePanels();
    setActiveWorkspace('items');
  });
  elements.stagingTab.addEventListener('click', () => {
    closePanels();
    setActiveWorkspace('staging');
  });
  elements.pasteStaging.addEventListener('click', () => void pasteCurrentClipboard());
  elements.clearStaging.addEventListener('click', () => void clearAllStaging());
  elements.settingsButton.addEventListener('click', openSettings);
  elements.hideButton.addEventListener('click', hideToTray);
  elements.closeButton.addEventListener('click', hideToTray);
  elements.pinButton.addEventListener('click', async () => {
    applyWindowState(await bridge.setPinned(!windowState.pinned));
  });
  elements.sortByTimeButton.addEventListener('click', () => {
    sortOpenItemsByTime();
  });
  elements.edgeHandle.addEventListener('click', async () => applyWindowState(await bridge.restoreFromEdge()));
  for (const closeButton of elements.closePanelButtons) closeButton.addEventListener('click', closePanels);

  for (const choice of elements.themeChoices) {
    choice.addEventListener('click', () => setTheme(choice.dataset.themeChoice));
  }
  elements.opacityInput.addEventListener('input', () => setOpacity(elements.opacityInput.value));
  elements.fontSizeInput.addEventListener('input', () => setFontSize(elements.fontSizeInput.value));
  elements.applySize.addEventListener('click', async () => {
    const limits = windowState.sizeLimits;
    const requested = {
      width: clamp(elements.widthInput.value, limits.minWidth, limits.maxWidth, 420),
      height: clamp(elements.heightInput.value, limits.minHeight, limits.maxHeight, 340),
    };
    applyWindowState(await bridge.setWindowSize(requested));
    showToast(`尺寸已调整为 ${windowState.size.width} × ${windowState.size.height}`);
  });
  elements.pinToggle.addEventListener('change', async () => {
    applyWindowState(await bridge.setPinned(elements.pinToggle.checked));
  });
  elements.launchAtLoginToggle.addEventListener('change', () => {
    void updateLaunchAtLogin(elements.launchAtLoginToggle.checked);
  });
  elements.settingsPanel.addEventListener('scroll', () => {
    if (elements.settingsPanel.scrollTop !== 0) elements.settingsPanel.scrollTop = 0;
  });

  elements.datePickerButton.addEventListener('click', () => {
    if (elements.datePickerPanel.hidden) openDatePicker();
    else closeSchedulePickers();
  });
  elements.datePickerPrev.addEventListener('click', () => {
    calendarView = calendarView.month === 0
      ? { year: calendarView.year - 1, month: 11 }
      : { year: calendarView.year, month: calendarView.month - 1 };
    renderDatePicker();
  });
  elements.datePickerNext.addEventListener('click', () => {
    calendarView = calendarView.month === 11
      ? { year: calendarView.year + 1, month: 0 }
      : { year: calendarView.year, month: calendarView.month + 1 };
    renderDatePicker();
  });
  elements.clearDate.addEventListener('click', () => {
    elements.datetimeDateInput.value = '';
    syncDatePicker();
    closeSchedulePickers();
  });
  elements.timeTextInput.addEventListener('focus', openTimePicker);
  elements.timeTextInput.addEventListener('input', () => {
    const sanitized = elements.timeTextInput.value.replace(/[^\d:：.]/g, '').slice(0, 5);
    if (sanitized !== elements.timeTextInput.value) elements.timeTextInput.value = sanitized;
    clearTimeInputError();
    highlightTimePicker();
  });
  elements.timeTextInput.addEventListener('blur', () => {
    if (!elements.timeTextInput.value) return;
    const normalized = normalizeDirectTime(elements.timeTextInput.value);
    if (normalized) elements.timeTextInput.value = normalized;
    highlightTimePicker();
  });
  elements.timeTextInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      elements.saveSchedule.click();
    }
  });
  elements.clearTime.addEventListener('click', () => {
    elements.timeTextInput.value = '';
    clearTimeInputError();
    highlightTimePicker();
    closeSchedulePickers();
  });
  document.addEventListener('pointerdown', (event) => {
    if (elements.schedulePanel.hidden) return;
    if (event.target.closest('.schedule-picker')) return;
    closeSchedulePickers();
  });
  elements.saveSchedule.addEventListener('click', () => {
    if (!activeScheduleItemId) return;
    const typed = elements.timeTextInput.value.trim();
    const time = typed ? normalizeDirectTime(typed) : '';
    if (typed && !time) {
      showToast('请输入有效时间，例如 14:44');
      markTimeInputError();
      return;
    }
    if (time) elements.timeTextInput.value = time;
    const date = elements.datetimeDateInput.value;
    let schedule = { mode: 'none', value: '' };
    if (date && time) schedule = { mode: 'datetime', value: `${date}T${time}` };
    else if (date) schedule = { mode: 'date', value: date };
    else if (time) schedule = { mode: 'time', value: time };
    updateSchedule(activeScheduleItemId, schedule);
    closePanels();
  });

  document.addEventListener('paste', (event) => {
    if (targetAcceptsTextInput(event.target)) return;
    event.preventDefault();
    if (event.clipboardData?.files?.length) {
      void importStagingFileObjects(event.clipboardData.files);
    } else {
      void pasteCurrentClipboard();
    }
  });

  document.addEventListener('dragenter', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    stagingDragDepth += 1;
    elements.dropOverlay.hidden = false;
  });
  document.addEventListener('dragover', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('dragleave', (event) => {
    if (!dragContainsFiles(event)) return;
    stagingDragDepth = Math.max(0, stagingDragDepth - 1);
    if (stagingDragDepth === 0) elements.dropOverlay.hidden = true;
  });
  document.addEventListener('drop', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    const files = event.dataTransfer.files;
    hideDropOverlay();
    void importStagingFileObjects(files);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (closeSchedulePickers()) return;
      closePanels();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      if (state.workspace === 'staging') void createStagingText();
      else {
        setActiveWorkspace('items');
        elements.itemComposerInput.focus();
      }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateHeaderDate();
  });
  window.addEventListener('beforeunload', () => {
    clearInterval(dateRefreshTimer);
    for (const item of stagingState.items) {
      if (item.type === 'text' && stagingTextSaveTimers.has(item.id)) {
        void persistStagingText(item.id, item.text);
      }
    }
    saveState();
  });
  bridge.onWindowStateChanged(applyWindowState);
  bridge.onCreateItemRequested(() => {
    closePanels();
    setActiveWorkspace('items');
    elements.itemComposerInput.focus();
  });
}

async function bootstrap() {
  // Persist migrations immediately so an unchanged legacy note is not migrated
  // from scratch on every launch.
  saveState();
  startHeaderDateClock();
  applyAppearance();
  renderItems();
  renderStagingItems();
  bindEvents();
  setActiveWorkspace(state.workspace, { persist: false });
  const [nextWindowState] = await Promise.all([
    bridge.getWindowState(),
    refreshStaging(),
  ]);
  applyWindowState(nextWindowState);
  setActiveWorkspace(state.workspace, { persist: false });
}

async function createQaImageBytes(startColor, endColor, width = 160, height = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.42;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.ellipse(width * 0.74, height * 0.23, width * 0.39, height * 0.31, -0.34, 0, Math.PI * 2);
  context.fill();
  if (height > width) {
    context.globalAlpha = 0.7;
    context.fillStyle = '#ffffff';
    context.fillRect(width * 0.08, height * 0.06, width * 0.84, height * 0.88);
    context.globalAlpha = 0.5;
    context.fillStyle = '#7b8490';
    for (let row = 0; row < 11; row += 1) {
      const y = height * (0.12 + row * 0.07);
      context.fillRect(width * 0.14, y, width * (row % 3 === 0 ? 0.58 : 0.68), 2);
    }
  }
  context.globalAlpha = 1;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

function waitForImageSource(source) {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(false), 2500);
    image.addEventListener('load', () => {
      clearTimeout(timer);
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    }, { once: true });
    image.addEventListener('error', () => {
      clearTimeout(timer);
      resolve(false);
    }, { once: true });
    image.src = source;
  });
}

window.__desktopQa = {
  async runFunctionalChecks() {
    const sampleHeaderDate = new Date(2026, 7, 12, 23, 59, 0);
    const sampleHeaderDisplay = updateHeaderDate(sampleHeaderDate);
    const headerDateStyles = getComputedStyle(elements.todayDate);
    const headerDateWorks = sampleHeaderDisplay === '8月12日 周三'
      && elements.todayDate.textContent === '8月12日 周三'
      && elements.todayDate.dateTime === '2026-08-12'
      && headerDateStyles.fontSize === '13px'
      && Number.parseFloat(headerDateStyles.fontSize) < 17
      && headerDateStyles.fontVariantNumeric.includes('tabular-nums');
    const headerDecorationRemoved = !document.querySelector('.drag-mark')
      && Boolean(elements.todayDate.closest('.drag-surface'));
    const dragSurfaceRect = elements.todayDate.closest('.drag-surface').getBoundingClientRect();
    const headerDragSpaceWorks = dragSurfaceRect.width >= 110;
    const todoTerminologyWorks = elements.itemsTab.querySelector('span')?.textContent.trim() === '待办'
      && elements.addItem.getAttribute('aria-label')?.includes('待办')
      && elements.itemsWorkspace.getAttribute('aria-label') === '待办工作区';
    updateHeaderDate();

    const launchAtLoginInitial = await bridge.getLaunchAtLogin();
    const launchAtLoginEnabled = await bridge.setLaunchAtLogin(true);
    const launchAtLoginDisabled = await bridge.setLaunchAtLogin(false);
    applyLaunchAtLoginState({ ...launchAtLoginDisabled, loaded: true, busy: false });
    const launchAtLoginWorks = launchAtLoginInitial.supported === true
      && launchAtLoginInitial.enabled === false
      && launchAtLoginEnabled.enabled === true
      && launchAtLoginDisabled.enabled === false
      && !launchAtLoginEnabled.error
      && !launchAtLoginDisabled.error
      && ['development', 'packaged', 'portable'].includes(launchAtLoginEnabled.targetType)
      && elements.launchAtLoginToggle.type === 'checkbox'
      && elements.launchAtLoginToggle.checked === false
      && elements.launchAtLoginHint.textContent.includes('默认关闭');

    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(V2_STORAGE_KEY, JSON.stringify({
      notes: [{ id: 'migrated', body: '旧版正文', createdAt: 1, updatedAt: 1 }],
    }));
    const migrated = loadState();
    localStorage.removeItem(V2_STORAGE_KEY);
    const v2MigrationWorks = migrated.items.length === 1
      && migrated.items[0].body === '旧版正文'
      && migrated.items[0].schedule.mode === 'none';

    state = { items: [], appearance: { theme: 'graphite', opacity: 88 }, workspace: 'items' };
    for (let index = 0; index < 8; index += 1) {
      createItem(`待办 ${index + 1}`);
    }
    closePanels();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const createdMany = state.items.length === 8;
    const scrollsWhenOverflowing = elements.itemsList.scrollHeight > elements.itemsList.clientHeight;
    const directlyEditable = [...document.querySelectorAll('.item-editor')]
      .every((editor) => editor.tagName === 'TEXTAREA' && !editor.readOnly);
    const oneLineEditors = [...document.querySelectorAll('.item-editor')];
    const typographyImproved = oneLineEditors.every((editor) => {
      const styles = getComputedStyle(editor);
      return styles.fontSize === '13px' && styles.fontFamily.includes('Microsoft YaHei UI');
    });
    setFontSize(20);
    const fontSizeLargeWorks = getComputedStyle(oneLineEditors[0]).fontSize === '20px'
      && getComputedStyle(elements.todayDate).fontSize === '20px'
      && Number.parseFloat(getComputedStyle(document.querySelector('.setting-label')).fontSize) > 16;
    setFontSize(12);
    const fontSizeSmallWorks = getComputedStyle(oneLineEditors[0]).fontSize === '12px';
    setFontSize(13);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const fontSizeAdjustWorks = fontSizeLargeWorks
      && fontSizeSmallWorks
      && getComputedStyle(oneLineEditors[0]).fontSize === '13px'
      && elements.fontSizeInput.min === '12'
      && elements.fontSizeInput.max === '20';
    const singleLineCentered = oneLineEditors.every((editor) => {
      const editorRect = editor.getBoundingClientRect();
      const rowRect = editor.closest('.item-row').getBoundingClientRect();
      return editorRect.height <= EDITOR_MIN_HEIGHT + 1
        && Math.abs((editorRect.top + editorRect.height / 2) - (rowRect.top + rowRect.height / 2)) <= 1;
    });

    const emptyTodoId = createItem('');
    const emptyDeleteButton = document.querySelector(`[data-item-id="${emptyTodoId}"] .delete-button`);
    emptyDeleteButton?.click();
    const emptyTodoDeletesImmediately = !state.items.some((item) => item.id === emptyTodoId)
      && !emptyDeleteButton?.classList.contains('is-confirming');
    const guardedTodoId = createItem('需要确认的待办');
    const guardedDeleteButton = document.querySelector(`[data-item-id="${guardedTodoId}"] .delete-button`);
    guardedDeleteButton?.click();
    const nonEmptyTodoRequiresConfirmation = state.items.some((item) => item.id === guardedTodoId)
      && guardedDeleteButton?.classList.contains('is-confirming');
    guardedDeleteButton?.click();

    const multilineId = state.items[3].id;
    state.items.find((item) => item.id === multilineId).body = '两行待办\n仍然居中';
    saveState();
    renderItems();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const multilineEditor = document.querySelector(`[data-item-id="${multilineId}"] .item-editor`);
    const multilineRect = multilineEditor.getBoundingClientRect();
    const multilineRowRect = multilineEditor.closest('.item-row').getBoundingClientRect();
    const editorAutoHeightWorks = multilineRect.height >= 39
      && multilineRect.height <= EDITOR_MAX_HEIGHT
      && Math.abs((multilineRect.top + multilineRect.height / 2)
        - (multilineRowRect.top + multilineRowRect.height / 2)) <= 1;

    const exactId = state.items[0].id;
    const dateId = state.items[1].id;
    const emptyId = state.items[2].id;
    openSchedule(exactId);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    elements.datetimeDateInput.value = '2026-08-20';
    elements.timeTextInput.value = '1444';
    elements.saveSchedule.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    openSchedule(emptyId);
    elements.datetimeDateInput.value = '';
    elements.timeTextInput.value = '';
    elements.saveSchedule.click();
    const unsetClearsTime = state.items.find((item) => item.id === emptyId).schedule.mode === 'none'
      && state.items.find((item) => item.id === emptyId).schedule.value === '';
    openSchedule(emptyId);
    elements.datetimeDateInput.value = '';
    elements.timeTextInput.value = '905';
    elements.saveSchedule.click();
    const timeOnlyWorks = state.items.find((item) => item.id === emptyId).schedule.mode === 'time'
      && state.items.find((item) => item.id === emptyId).schedule.value === '09:05';
    const directTimeInputWorks = state.items.find((item) => item.id === exactId).schedule.value === '2026-08-20T14:44'
      && normalizeDirectTime('905') === '09:05'
      && normalizeDirectTime('23：59') === '23:59'
      && normalizeDirectTime('24:00') === null
      && elements.datetimeDateInput.type === 'date'
      && elements.timeTextInput.type === 'text'
      && unsetClearsTime
      && timeOnlyWorks;
    updateSchedule(dateId, { mode: 'date', value: '2026-08-21' });
    updateSchedule(emptyId, { mode: 'none', value: '' });
    const exactMinuteWorks = state.items.find((item) => item.id === exactId).schedule.value === '2026-08-20T14:44';
    const dateOnlyWorks = state.items.find((item) => item.id === dateId).schedule.value === '2026-08-21';
    const emptyTimeWorks = state.items.find((item) => item.id === emptyId).schedule.mode === 'none';
    const exactButton = document.querySelector(`[data-item-id="${exactId}"] .schedule-button`);
    const dateButton = document.querySelector(`[data-item-id="${dateId}"] .schedule-button`);
    const emptyButton = document.querySelector(`[data-item-id="${emptyId}"] .schedule-button`);
    const exactStyles = exactButton ? getComputedStyle(exactButton) : null;
    const exactTextStyles = exactButton?.querySelector('.time-main')
      ? getComputedStyle(exactButton.querySelector('.time-main'))
      : null;
    const emptyHintStyles = emptyButton ? getComputedStyle(emptyButton, '::after') : null;
    const emptyRect = emptyButton?.getBoundingClientRect();
    emptyButton?.click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const invisibleTimeClickable = !elements.schedulePanel.hidden;
    closePanels();
    const timeControlImproved = Boolean(
      exactButton?.dataset.mode === 'datetime'
      && exactButton.querySelector('.time-main')?.textContent === '14:44'
      && dateButton?.dataset.mode === 'date'
      && dateButton.querySelector('.time-main')?.textContent === '8月21日'
      && emptyButton?.dataset.mode === 'none'
      && emptyButton.querySelector('.time-main')?.textContent === ''
      && !exactButton.querySelector('.schedule-icon')
      && !exactButton.querySelector('.time-sub')
      && exactStyles?.borderTopWidth === '0px'
      && exactTextStyles?.fontSize === '11px'
      && emptyHintStyles?.content.includes('设置时间')
      && Number(emptyRect?.width) >= 48
      && Number(emptyRect?.height) >= 20
      && invisibleTimeClickable
      && Boolean(document.querySelector('#clearDate') && document.querySelector('#clearTime')),
    );

    const movedId = state.items.at(-1).id;
    moveItem(movedId, 0);
    const reorderWorks = state.items[0].id === movedId;
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const reorderPersisted = persisted.items[0].id === movedId;

    const sortLateId = createItem('较晚时间');
    const sortEarlyId = createItem('较早时间');
    const sortNoneId = createItem('没有时间');
    const sortDoneId = createItem('已完成更早');
    updateSchedule(sortLateId, { mode: 'time', value: '23:00' });
    updateSchedule(sortEarlyId, { mode: 'time', value: '08:00' });
    updateSchedule(sortDoneId, { mode: 'time', value: '01:00' });
    setItemDone(sortDoneId, true);
    elements.sortByTimeButton.click();
    const openAfterSort = state.items.filter((item) => !item.done).map((item) => item.id);
    const sortOpenItemsByTimeWorks = Boolean(elements.sortByTimeButton)
      && openAfterSort.indexOf(sortEarlyId) < openAfterSort.indexOf(sortLateId)
      && openAfterSort.indexOf(sortLateId) < openAfterSort.indexOf(sortNoneId)
      && state.items.findIndex((item) => item.id === sortDoneId)
        > state.items.findIndex((item) => item.id === sortNoneId);

    await bridge.clearStaging();
    const referenceImport = await bridge.importStagingFiles([{
      name: '参考图.png',
      bytes: await createQaImageBytes('#eee7d6', '#9fabb8', 278, 513),
    }]);
    const referenceId = referenceImport.item?.id ?? referenceImport.createdIds?.[0];
    const textCreate = await bridge.createStagingText('登录页交互参考，稍后整理');
    const textId = textCreate.item?.id;
    const screenImport = await bridge.importStagingFiles([{
      name: '屏幕截图',
      bytes: await createQaImageBytes('#f28232', '#0865b8'),
    }]);
    const screenId = screenImport.item?.id ?? screenImport.createdIds?.[0];
    const stagingCreated = Boolean(referenceImport.ok && textCreate.ok && screenImport.ok)
      && (await bridge.listStaging()).items.length === 3;

    const reorderedStaging = await bridge.reorderStaging([referenceId, screenId, textId]);
    const stagingReorderWorks = reorderedStaging.ok
      && reorderedStaging.items[0]?.id === referenceId
      && (await bridge.listStaging()).items[0]?.id === referenceId;
    await bridge.reorderStaging([screenId, textId, referenceId]);
    const updatedStagingText = await bridge.updateStagingText(textId, '登录页交互参考，稍后整理');
    const stagingTextPersistenceWorks = updatedStagingText.ok
      && (await bridge.listStaging()).items.find((item) => item.id === textId)?.text === '登录页交互参考，稍后整理';

    const temporaryText = await bridge.createStagingText('待删除测试项');
    const removedTemporary = await bridge.deleteStagingItem(temporaryText.item?.id);
    const stagingDeleteWorks = removedTemporary.ok
      && removedTemporary.items.length === 3
      && !removedTemporary.items.some((item) => item.id === temporaryText.item?.id);
    const imageCopyResult = await bridge.copyStagingItem(screenId);
    const imageSaveResult = await bridge.saveStagingImage(screenId);
    const stagingImageActionsWork = imageCopyResult.ok && imageSaveResult.ok && imageSaveResult.saved;

    const finalStaging = await bridge.listStaging();
    applyStagingSnapshot(finalStaging);
    setActiveWorkspace('staging');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const screenItem = finalStaging.items.find((item) => item.id === screenId);
    const imageProtocolWorks = Boolean(screenItem) && await waitForImageSource(screenItem.thumbnailUrl);
    const stagingRows = [...document.querySelectorAll('.staging-row')];
    const stagingTextEditor = document.querySelector(`[data-staging-id="${textId}"] .staging-text-editor`);
    const stagingWorkspaceWorks = stagingCreated
      && elements.stagingWorkspace.hidden === false
      && elements.itemsWorkspace.hidden === true
      && stagingRows.length === 3
      && stagingRows.every((row) => row.querySelector('.staging-reorder'))
      && stagingTextEditor?.value === '登录页交互参考，稍后整理'
      && !stagingTextEditor.readOnly
      && elements.stagingList.scrollHeight > elements.stagingList.clientHeight;
    const previewResult = await bridge.openStagingPreview(referenceId);
    const stagingPreviewWorks = previewResult?.ok
      && previewResult.sourceSize?.width === 278
      && previewResult.sourceSize?.height === 513
      && previewResult.bounds?.width >= 360
      && previewResult.bounds?.height > 500;
    await bridge.closeStagingPreview();
    const textVisual = document.querySelector(`[data-staging-id="${textId}"] .staging-visual`);
    const stagingHoverIconWorks = Boolean(textVisual)
      && !textVisual.disabled
      && textVisual.getAttribute('aria-label')?.includes('预览文字');
    const longTextBody = Array.from(
      { length: 16 },
      (_, index) => `第 ${index + 1} 段：登录页交互说明，覆盖按钮状态、错误提示和跳转。`,
    ).join('\n');
    const longText = await bridge.createStagingText(longTextBody);
    const textPreviewResult = await bridge.openStagingPreview(longText.item?.id);
    const stagingTextPreviewWorks = textPreviewResult?.ok
      && textPreviewResult.itemType === 'text'
      && textPreviewResult.bounds?.width >= 360;
    await bridge.closeStagingPreview();
    await bridge.deleteStagingItem(longText.item?.id);
    await bridge.hideStagingHover();
    closePanels();

    const showcaseItems = state.items.slice(0, 3);
    showcaseItems[0].body = '便签';
    showcaseItems[0].schedule = { mode: 'date', value: '2026-08-12' };
    showcaseItems[1].body = '找工作';
    showcaseItems[1].schedule = { mode: 'datetime', value: '2026-08-12T14:44' };
    showcaseItems[2].body = '大论文修改';
    showcaseItems[2].schedule = { mode: 'none', value: '' };
    saveState();
    renderItems();

    return {
      headerDateWorks,
      headerDecorationRemoved,
      headerDragSpaceWorks,
      todoTerminologyWorks,
      createdMany,
      scrollsWhenOverflowing,
      directlyEditable,
      typographyImproved,
      fontSizeAdjustWorks,
      singleLineCentered,
      emptyTodoDeletesImmediately,
      nonEmptyTodoRequiresConfirmation,
      editorAutoHeightWorks,
      timeControlImproved,
      directTimeInputWorks,
      exactMinuteWorks,
      dateOnlyWorks,
      emptyTimeWorks,
      reorderWorks,
      reorderPersisted,
      sortOpenItemsByTimeWorks,
      stagingWorkspaceWorks,
      stagingReorderWorks,
      stagingTextPersistenceWorks,
      stagingDeleteWorks,
      stagingImageActionsWork,
      imageProtocolWorks,
      stagingPreviewWorks,
      stagingHoverIconWorks,
      stagingTextPreviewWorks,
      v2MigrationWorks,
      launchAtLoginWorks,
    };
  },
  async setThemeAndMeasure(theme, opacity) {
    closePanels();
    setActiveWorkspace('items', { persist: false });
    setTheme(theme);
    setOpacity(opacity);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const header = document.querySelector('.title-bar').getBoundingClientRect();
    const firstRow = document.querySelector('.item-row').getBoundingClientRect();
    const editor = document.querySelector('.item-editor').getBoundingClientRect();
    const schedule = document.querySelector('.schedule-button').getBoundingClientRect();
    const centerDelta = Math.abs((editor.top + editor.height / 2) - (firstRow.top + firstRow.height / 2));
    return {
      theme,
      opacity: getComputedStyle(elements.app).getPropertyValue('--panel-alpha').trim(),
      metrics: {
        headerHeight: Math.round(header.height),
        rowHeight: Math.round(firstRow.height),
        editorWidth: Math.round(editor.width),
        editorHeight: Math.round(editor.height),
        editorCenterDelta: Number(centerDelta.toFixed(2)),
        scheduleWidth: Math.round(schedule.width),
        scheduleHeight: Math.round(schedule.height),
      },
    };
  },
  async measureOpacityRange(theme) {
    closePanels();
    setTheme(theme);
    const shell = document.querySelector('.widget-shell');
    const previousOpacity = state.appearance.opacity;
    const previousTransition = shell.style.transition;
    const samples = [];
    shell.style.transition = 'none';
    for (const opacity of [50, 75, 100]) {
      setOpacity(opacity);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const surfaceColor = getComputedStyle(shell).backgroundColor;
      const channels = surfaceColor.match(/[\d.]+/g)?.map(Number) ?? [];
      samples.push({
        opacity,
        panelAlpha: Number(getComputedStyle(elements.app).getPropertyValue('--panel-alpha').trim()),
        surfaceAlpha: surfaceColor.startsWith('rgba') ? channels.at(-1) : 1,
        surfaceColor,
      });
    }
    setOpacity(previousOpacity);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    shell.style.transition = previousTransition;
    return { theme, samples };
  },
  async measureStagingLayout(theme) {
    closePanels();
    setTheme(theme);
    setActiveWorkspace('staging', { persist: false });
    renderStagingItems();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const shell = document.querySelector('.widget-shell').getBoundingClientRect();
    const row = document.querySelector('.staging-row').getBoundingClientRect();
    const handle = document.querySelector('.staging-reorder').getBoundingClientRect();
    const visual = document.querySelector('.staging-visual').getBoundingClientRect();
    const footer = document.querySelector('.staging-footer').getBoundingClientRect();
    const name = document.querySelector('.staging-image-name');
    return {
      theme,
      metrics: {
        shellWidth: Math.round(shell.width),
        shellHeight: Math.round(shell.height),
        rowHeight: Math.round(row.height),
        handleWidth: Math.round(handle.width),
        visualWidth: Math.round(visual.width),
        visualHeight: Math.round(visual.height),
        footerHeight: Math.round(footer.height),
        imageNameFontSize: getComputedStyle(name).fontSize,
      },
    };
  },
  openSettings(theme) {
    setTheme(theme);
    openSettings();
  },
  openSettingsSection(section) {
    showSettingsSection(section);
  },
  openDirectTimePanel(theme = 'graphite') {
    setActiveWorkspace('items', { persist: false });
    setTheme(theme);
    const item = state.items.find((candidate) => candidate.schedule.mode === 'datetime') ?? state.items[0];
    if (!item) return false;
    openSchedule(item.id);
    return true;
  },
  openStagingShowcase(theme = 'gray') {
    closePanels();
    setTheme(theme);
    setActiveWorkspace('staging', { persist: false });
    renderStagingItems();
    return stagingState.items.length;
  },
  openStagingPreview() {
    const image = stagingState.items
      .filter((item) => item.type === 'image')
      .sort((first, second) => (second.height / Math.max(1, second.width))
        - (first.height / Math.max(1, first.width)))[0];
    return image ? openStagingItemPreview(image.id) : false;
  },
  showStagingHover(kind = 'text') {
    const item = kind === 'image'
      ? stagingState.items.find((candidate) => candidate.type === 'image')
      : stagingState.items.find((candidate) => candidate.type === 'text');
    return item ? bridge.showStagingHover(item.id) : { ok: false };
  },
  hideStagingHover() {
    return bridge.hideStagingHover();
  },
  closePanels,
};

bootstrap();
