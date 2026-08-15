const {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  net,
  protocol,
  screen,
  shell,
  Tray,
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveLaunchAtLoginState } = require('./src/login-item-state.cjs');
const { createStagingStore } = require('./src/staging-store.cjs');

function guardGuiOutputStream(stream) {
  // Packaged Electron GUI children can outlive their portable launcher. If the
  // inherited stdout/stderr pipe is already closed, logging must never crash
  // the desktop widget or surface an Electron main-process error dialog.
  stream?.on?.('error', () => {});
}

guardGuiOutputStream(process.stdout);
guardGuiOutputStream(process.stderr);

const APP_NAME = '桌面便签';
const SHORTCUT = 'CommandOrControl+Shift+Space';
const DEFAULT_SIZE = { width: 420, height: 340 };
const SIZE_LIMITS = {
  minWidth: 320,
  maxWidth: 640,
  minHeight: 280,
  maxHeight: 640,
};
const EDGE_THRESHOLD = 30;
const EDGE_REVEAL = 26;
const EDGE_HANDLE_LENGTH = 68;
const EDGE_HOVER_OPEN_DELAY = 120;
const EDGE_HOVER_CLOSE_DELAY = 220;
const EDGE_HOVER_POLL_INTERVAL = 50;
const RESTORE_INSET = 38;
const VALID_EDGES = new Set(['left', 'right', 'top', 'bottom']);
const STAGING_SCHEME = 'staging-image';
const MAX_STAGING_IMPORT_BATCH = 20;
const BLOCKED_OPEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.ps1', '.scr', '.vbs', '.js', '.jse', '.wsf', '.wsh', '.msc',
]);
const PREVIEW_MIN_WIDTH = 360;
const PREVIEW_MIN_HEIGHT = 260;
const PREVIEW_MAX_WIDTH = 1400;
const PREVIEW_MAX_HEIGHT = 1000;
const PREVIEW_SCREEN_MARGIN = 36;
const PREVIEW_HORIZONTAL_CHROME = 24;
const PREVIEW_VERTICAL_CHROME = 82;
const HOVER_PREVIEW_GAP = 4;
const HOVER_PREVIEW_OPEN_DELAY = 70;
const HOVER_PREVIEW_CLOSE_DELAY = 220;
const HOVER_PREVIEW_KEEP_PAD = 20;
const HOVER_PREVIEW_MAX_WIDTH = 360;
const HOVER_PREVIEW_MAX_HEIGHT = 720;
const HOVER_PREVIEW_MIN_WIDTH = 176;
const HOVER_PREVIEW_MIN_HEIGHT = 72;
const HOVER_PREVIEW_PAD_X = 24;
const HOVER_PREVIEW_PAD_Y = 24;

protocol.registerSchemesAsPrivileged([{
  scheme: STAGING_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
  },
}]);

let mainWindow = null;
let previewWindow = null;
let previewItemId = null;
let hoverPreviewWindow = null;
let hoverPreviewItemId = null;
let hoverPreviewWantedId = null;
let hoverPreviewShowTimer = null;
let hoverPreviewHideTimer = null;
let hoverPreviewProtectUntil = 0;
let hoverAnchorRect = null;
let tray = null;
let isQuitting = false;
let isPinned = true;
let shortcutRegistered = false;
let dockedEdge = null;
let isEdgePreviewed = false;
let currentSize = { ...DEFAULT_SIZE };
let normalBounds = null;
let persistedNormalBounds = null;
let isProgrammaticMove = false;
let programmaticMoveTimer = null;
let programmaticMoveTarget = null;
let manualMoveFinishTimer = null;
let stateWriteTimer = null;
let edgeHoverMonitorTimer = null;
let edgeSurfaceRefreshTimer = null;
let edgePreviewShowTimer = null;
let edgeHoverEnteredAt = 0;
let edgeHoverLeftAt = 0;
let edgeHoverArmed = false;
let pendingCreateItem = false;
let backgroundServicesStarted = false;
let backgroundServicesTimer = null;
let qaLaunchAtLoginEnabled = false;
let stagingStore = null;

const qaOutputDirectory = process.env.DESKTOP_NOTE_QA_DIR
  ? path.resolve(process.env.DESKTOP_NOTE_QA_DIR)
  : null;
const userDataOverrideDirectory = process.env.DESKTOP_NOTE_USER_DATA_DIR
  ? path.resolve(process.env.DESKTOP_NOTE_USER_DATA_DIR)
  : null;

if (qaOutputDirectory) {
  app.setPath('userData', path.join(qaOutputDirectory, `user-data-${process.pid}`));
} else if (userDataOverrideDirectory) {
  app.setPath('userData', userDataOverrideDirectory);
}

// Pointer QA uses an isolated user-data directory and must coexist with the
// user's normal desktop-note process. Production launches retain the lock.
const hasSingleInstanceLock = userDataOverrideDirectory || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.round(number), min), max);
}

function clampSize(size) {
  return {
    width: clampNumber(size?.width, SIZE_LIMITS.minWidth, SIZE_LIMITS.maxWidth, DEFAULT_SIZE.width),
    height: clampNumber(size?.height, SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight, DEFAULT_SIZE.height),
  };
}

function getStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function getStagingStore() {
  if (!stagingStore) {
    stagingStore = createStagingStore({
      baseDirectory: path.join(app.getPath('userData'), 'staging'),
      nativeImage,
    });
  }
  return stagingStore;
}

function serializeStagingItem(item) {
  if (!item || item.type !== 'image') return item;
  const version = encodeURIComponent(String(item.updatedAt));
  const id = encodeURIComponent(item.id);
  return {
    ...item,
    thumbnailUrl: `${STAGING_SCHEME}://item/${id}?kind=thumbnail&v=${version}`,
    originalUrl: `${STAGING_SCHEME}://item/${id}?kind=original&v=${version}`,
  };
}

async function getStagingSnapshot(extra = {}) {
  const store = getStagingStore();
  return {
    ok: true,
    items: (await store.list()).map(serializeStagingItem),
    limits: store.limits,
    ...extra,
  };
}

function getStagingError(error, fallback = '暂存操作失败') {
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
}

async function runStagingMutation(operation, extra = {}) {
  try {
    const item = await operation();
    return getStagingSnapshot({
      ...extra,
      item: item?.id ? serializeStagingItem(item) : undefined,
    });
  } catch (error) {
    return { ok: false, error: getStagingError(error) };
  }
}

function bufferFromIpcPayload(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  throw new TypeError('图片数据无效');
}

async function importStagingPayloads(payloads) {
  const store = getStagingStore();
  const candidates = Array.isArray(payloads) ? payloads.slice(0, MAX_STAGING_IMPORT_BATCH) : [];
  const imported = [];
  const errors = [];
  for (const candidate of candidates) {
    try {
      imported.push(await store.importImageBuffer(bufferFromIpcPayload(candidate?.bytes), {
        name: candidate?.name,
      }));
    } catch (error) {
      errors.push(getStagingError(error, '图片导入失败'));
    }
  }
  if (imported.length === 0) {
    return {
      ok: false,
      error: errors[0] ?? '没有可导入的图片',
      errors,
    };
  }
  return getStagingSnapshot({
    imported: imported.length,
    createdIds: imported.map((item) => item.id),
    warning: errors.length ? `${errors.length} 张图片未能导入` : null,
  });
}

function parseClipboardPathBuffer(buffer, wide = true, offset = 0) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= offset) return [];
  const encoding = wide ? 'utf16le' : 'latin1';
  return buffer.subarray(offset).toString(encoding)
    .split('\0')
    .map((value) => value.trim())
    .filter((value) => value && path.isAbsolute(value));
}

function readClipboardFilePaths() {
  const formats = new Set(clipboard.availableFormats('clipboard'));
  const candidates = [];
  try {
    if (formats.has('CF_HDROP')) {
      const dropBuffer = clipboard.readBuffer('CF_HDROP');
      if (dropBuffer.length >= 20) {
        const offset = dropBuffer.readUInt32LE(0);
        const wide = dropBuffer.readUInt32LE(16) !== 0;
        candidates.push(...parseClipboardPathBuffer(dropBuffer, wide, offset));
      }
    }
  } catch {}
  for (const [format, wide] of [['FileNameW', true], ['FileName', false]]) {
    if (!formats.has(format)) continue;
    try {
      candidates.push(...parseClipboardPathBuffer(clipboard.readBuffer(format), wide));
    } catch {}
  }
  return [...new Set(candidates)].filter((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }).slice(0, MAX_STAGING_IMPORT_BATCH);
}

async function importStagingPaths(filePaths) {
  const store = getStagingStore();
  const imported = [];
  const errors = [];
  for (const filePath of filePaths.slice(0, MAX_STAGING_IMPORT_BATCH)) {
    try {
      imported.push(await store.importLocalFile(filePath));
    } catch (error) {
      errors.push(getStagingError(error, `${path.basename(filePath)} 导入失败`));
    }
  }
  if (imported.length === 0) {
    return { ok: false, error: errors[0] ?? '没有可暂存的文件', errors };
  }
  return getStagingSnapshot({
    imported: imported.length,
    createdIds: imported.map((item) => item.id),
    warning: errors.length ? `${errors.length} 张图片未能导入` : null,
  });
}

function clipboardImageName() {
  const date = new Date();
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ];
  return `剪贴板图片 ${parts.join('')}.png`;
}

async function pasteToStaging() {
  const filePaths = readClipboardFilePaths();
  if (filePaths.length) return importStagingPaths(filePaths);

  const clipboardImage = clipboard.readImage('clipboard');
  if (!clipboardImage.isEmpty()) {
    return runStagingMutation(
      () => getStagingStore().importImageBuffer(clipboardImage.toPNG(), { name: clipboardImageName() }),
      { imported: 1, source: 'clipboard-image' },
    );
  }

  const text = clipboard.readText('clipboard');
  if (text.trim()) {
    return runStagingMutation(
      () => getStagingStore().createText(text),
      { imported: 1, source: 'clipboard-text' },
    );
  }
  return { ok: false, error: '剪贴板中没有可暂存的文字、图片或文件' };
}

async function chooseStagingImages() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: '添加到暂存区',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '所有文件', extensions: ['*'] },
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
    ],
  });
  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  return importStagingPaths(selection.filePaths);
}

async function copyStagingItem(id) {
  try {
    const store = getStagingStore();
    const item = await store.getItem(String(id));
    if (!item) return { ok: false, error: '暂存项不存在' };
    if (qaOutputDirectory) return { ok: true, type: item.type };
    if (item.type === 'text') {
      clipboard.writeText(item.text);
    } else if (item.type === 'file') {
      clipboard.writeText(item.filePath);
    } else {
      const image = nativeImage.createFromPath(await store.getImagePath(item.id, 'original'));
      if (image.isEmpty()) return { ok: false, error: '无法读取暂存图片' };
      clipboard.writeImage(image);
    }
    return { ok: true, type: item.type };
  } catch (error) {
    return { ok: false, error: getStagingError(error, '复制失败') };
  }
}

async function saveStagingImage(id, ownerWindow = mainWindow) {
  try {
    const store = getStagingStore();
    const item = await store.getItem(String(id));
    if (!item) return { ok: false, error: '暂存项不存在' };
    if (item.type === 'text') return saveStagingText(id, ownerWindow);
    if (item.type === 'file') return saveStagingFile(id, ownerWindow);
    if (item.type !== 'image') return { ok: false, error: '暂存图片不存在' };
    const sourcePath = await store.getImagePath(item.id, 'original');
    if (qaOutputDirectory) {
      const destination = path.join(qaOutputDirectory, `saved-${item.suggestedName}`);
      await fs.promises.copyFile(sourcePath, destination);
      return { ok: true, saved: true, qaPath: destination };
    }
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: '另存暂存图片',
      defaultPath: path.join(app.getPath('pictures'), item.suggestedName),
      filters: [{ name: item.format, extensions: [path.extname(item.suggestedName).slice(1)] }],
    });
    if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };
    await fs.promises.copyFile(sourcePath, selection.filePath);
    return { ok: true, saved: true };
  } catch (error) {
    return { ok: false, error: getStagingError(error, '保存图片失败') };
  }
}

async function saveStagingText(id, ownerWindow = mainWindow) {
  try {
    const item = await getStagingStore().getItem(String(id));
    if (!item || item.type !== 'text') return { ok: false, error: '暂存文字不存在' };
    const timestamp = new Date(item.createdAt || Date.now()).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const suggestedName = `暂存文字-${timestamp}.txt`;
    if (qaOutputDirectory) {
      const destination = path.join(qaOutputDirectory, suggestedName);
      await fs.promises.writeFile(destination, item.text, 'utf8');
      return { ok: true, saved: true, type: 'text', qaPath: destination };
    }
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: '另存暂存文字',
      defaultPath: path.join(app.getPath('documents'), suggestedName),
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(selection.filePath, item.text, 'utf8');
    return { ok: true, saved: true, type: 'text' };
  } catch (error) {
    return { ok: false, error: getStagingError(error, '保存文字失败') };
  }
}

async function saveStagingFile(id, ownerWindow = mainWindow) {
  try {
    const item = await getStagingStore().getItem(String(id));
    if (!item || item.type !== 'file') return { ok: false, error: '暂存文件不存在' };
    if (!item.exists) return { ok: false, error: '文件已不存在' };
    if (qaOutputDirectory) {
      const destination = path.join(qaOutputDirectory, `saved-${item.name}`);
      await fs.promises.copyFile(item.filePath, destination);
      return { ok: true, saved: true, type: 'file', qaPath: destination };
    }
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: '另存文件副本',
      defaultPath: path.join(app.getPath('documents'), item.name),
    });
    if (selection.canceled || !selection.filePath) return { ok: false, canceled: true };
    await fs.promises.copyFile(item.filePath, selection.filePath);
    return { ok: true, saved: true, type: 'file' };
  } catch (error) {
    return { ok: false, error: getStagingError(error, '保存文件失败') };
  }
}

async function revealStagedFile(id) {
  const item = await getStagingStore().getItem(String(id));
  if (!item || item.type !== 'file') return { ok: false, error: '暂存文件不存在' };
  if (!item.exists) return { ok: false, error: '文件已不存在' };
  if (!qaOutputDirectory) shell.showItemInFolder(item.filePath);
  return { ok: true, type: 'file', revealed: true };
}

async function openStagedFile(id) {
  const item = await getStagingStore().getItem(String(id));
  if (!item || item.type !== 'file') return { ok: false, error: '暂存文件不存在' };
  if (!item.exists) return { ok: false, error: '文件已不存在' };
  const extension = (item.extension || path.extname(item.filePath)).toLowerCase();
  if (BLOCKED_OPEN_EXTENSIONS.has(extension)) {
    if (!qaOutputDirectory) shell.showItemInFolder(item.filePath);
    return { ok: true, type: 'file', revealed: true, blocked: true };
  }
  if (qaOutputDirectory) return { ok: true, type: 'file', opened: true };
  const error = await shell.openPath(item.filePath);
  if (error) return { ok: false, error: error || '无法打开文件' };
  return { ok: true, type: 'file', opened: true };
}

function estimateWrappedLines(text, columns) {
  const value = String(text ?? '');
  if (!value) return 1;
  return value.split(/\r?\n/).reduce((sum, line) => {
    let width = 0;
    let lines = 1;
    for (const char of line) {
      width += /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
      if (width > columns) {
        lines += 1;
        width = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
      }
    }
    return sum + lines;
  }, 0);
}

function getDisplayWorkArea(anchorBounds) {
  const source = anchorBounds
    ?? (mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null)
    ?? screen.getPrimaryDisplay().workArea;
  return screen.getDisplayMatching(source).workArea;
}

function getTextContentSize(text, maxWidth, maxHeight, minWidth, minHeight, lineHeight) {
  const columns = Math.max(16, Math.round((maxWidth - 28) / 13));
  const lines = estimateWrappedLines(text, columns);
  return {
    width: Math.min(maxWidth, Math.max(minWidth, text.length > 80 ? Math.min(maxWidth, 320) : 220)),
    height: Math.min(maxHeight, Math.max(minHeight, 28 + lines * lineHeight)),
  };
}

function getPreviewBounds(item) {
  const workArea = getDisplayWorkArea();
  const availableWidth = Math.max(
    240,
    Math.min(PREVIEW_MAX_WIDTH, workArea.width - PREVIEW_SCREEN_MARGIN * 2),
  );
  const availableHeight = Math.max(
    200,
    Math.min(PREVIEW_MAX_HEIGHT, workArea.height - PREVIEW_SCREEN_MARGIN * 2),
  );
  const minimumWidth = Math.min(PREVIEW_MIN_WIDTH, availableWidth);
  const minimumHeight = Math.min(PREVIEW_MIN_HEIGHT, availableHeight);
  const maximumContentWidth = Math.max(1, availableWidth - PREVIEW_HORIZONTAL_CHROME);
  const maximumContentHeight = Math.max(1, availableHeight - PREVIEW_VERTICAL_CHROME);
  let contentWidth;
  let contentHeight;
  if (item.type === 'file') {
    contentWidth = 320;
    contentHeight = 140;
  } else if (item.type === 'text') {
    const textSize = getTextContentSize(
      item.text ?? '',
      maximumContentWidth,
      maximumContentHeight,
      320,
      160,
      21,
    );
    contentWidth = Math.min(maximumContentWidth, Math.max(320, Math.min(560, textSize.width + 80)));
    contentHeight = textSize.height;
  } else {
    const scale = Math.min(
      1,
      maximumContentWidth / Math.max(1, item.width),
      maximumContentHeight / Math.max(1, item.height),
    );
    contentWidth = Math.max(1, Math.round(item.width * scale));
    contentHeight = Math.max(1, Math.round(item.height * scale));
  }
  const width = Math.min(
    availableWidth,
    Math.max(minimumWidth, contentWidth + PREVIEW_HORIZONTAL_CHROME),
  );
  const height = Math.min(
    availableHeight,
    Math.max(minimumHeight, contentHeight + PREVIEW_VERTICAL_CHROME),
  );
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
}

function getHoverPreviewBounds(item) {
  const mainBounds = mainWindow.getBounds();
  const workArea = getDisplayWorkArea(mainBounds);
  const maxWidth = Math.min(HOVER_PREVIEW_MAX_WIDTH, Math.max(180, workArea.width - 48));
  const maxHeight = Math.min(HOVER_PREVIEW_MAX_HEIGHT, Math.max(120, workArea.height - 48));
  let width;
  let height;
  if (item.type === 'file') {
    width = Math.min(maxWidth, Math.max(HOVER_PREVIEW_MIN_WIDTH, 300));
    height = Math.min(maxHeight, Math.max(HOVER_PREVIEW_MIN_HEIGHT, 158));
  } else if (item.type === 'text') {
    const textSize = getTextContentSize(
      item.text ?? '',
      maxWidth,
      maxHeight,
      HOVER_PREVIEW_MIN_WIDTH,
      HOVER_PREVIEW_MIN_HEIGHT,
      19,
    );
    width = textSize.width;
    height = textSize.height;
  } else {
    const innerWidth = Math.max(1, maxWidth - HOVER_PREVIEW_PAD_X);
    const innerHeight = Math.max(1, maxHeight - HOVER_PREVIEW_PAD_Y);
    const scale = Math.min(
      1,
      innerWidth / Math.max(1, item.width),
      innerHeight / Math.max(1, item.height),
    );
    width = Math.max(HOVER_PREVIEW_MIN_WIDTH, Math.round(item.width * scale) + HOVER_PREVIEW_PAD_X);
    height = Math.max(HOVER_PREVIEW_MIN_HEIGHT, Math.round(item.height * scale) + HOVER_PREVIEW_PAD_Y);
  }
  let y = mainBounds.y;
  if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;
  if (y < workArea.y) y = workArea.y;
  const leftX = mainBounds.x - width - HOVER_PREVIEW_GAP;
  const useLeft = leftX >= workArea.x;
  const x = useLeft
    ? leftX
    : Math.min(mainBounds.x + mainBounds.width + HOVER_PREVIEW_GAP, workArea.x + workArea.width - width);
  return { x, y, width, height, side: useLeft ? 'left' : 'right' };
}

function isPreviewWindowOpen(candidate) {
  return Boolean(candidate && !candidate.isDestroyed());
}

function pointIsNearBounds(point, bounds, padding = 0) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x - padding
    && point.x <= bounds.x + bounds.width + padding
    && point.y >= bounds.y - padding
    && point.y <= bounds.y + bounds.height + padding;
}

function getHoverAnchorScreenRects() {
  if (!hoverAnchorRect || !mainWindow || mainWindow.isDestroyed()) return [];
  const seen = new Set();
  const rects = [];
  for (const origin of [mainWindow.getContentBounds(), mainWindow.getBounds()]) {
    const key = `${origin.x},${origin.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rects.push({
      x: origin.x + hoverAnchorRect.x,
      y: origin.y + hoverAnchorRect.y,
      width: hoverAnchorRect.width,
      height: hoverAnchorRect.height,
    });
  }
  return rects;
}

function isCursorOverHoverAnchor(padding = 8, point = screen.getCursorScreenPoint()) {
  return getHoverAnchorScreenRects().some((rect) => pointIsNearBounds(point, rect, padding));
}

function isCursorOverPreviewWindows(point = screen.getCursorScreenPoint()) {
  if (isPreviewWindowOpen(hoverPreviewWindow)
      && pointIsNearBounds(point, hoverPreviewWindow.getBounds(), HOVER_PREVIEW_KEEP_PAD)) {
    return true;
  }
  return isPreviewWindowOpen(previewWindow)
    && pointIsNearBounds(point, previewWindow.getBounds(), HOVER_PREVIEW_KEEP_PAD);
}

function shouldKeepHoverPreview() {
  if (Date.now() < hoverPreviewProtectUntil) return true;
  const point = screen.getCursorScreenPoint();
  if (isCursorOverPreviewWindows(point)) return true;
  if (isCursorOverHoverAnchor(HOVER_PREVIEW_KEEP_PAD, point)) return true;
  return Boolean(
    mainWindow
    && !mainWindow.isDestroyed()
    && pointIsNearBounds(point, mainWindow.getBounds(), HOVER_PREVIEW_KEEP_PAD),
  );
}

function canShowHoverPreview() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (dockedEdge && !isEdgePreviewed) return false;
  return true;
}

function closeHoverPreviewWindow() {
  clearTimeout(hoverPreviewShowTimer);
  clearTimeout(hoverPreviewHideTimer);
  hoverPreviewWantedId = null;
  hoverAnchorRect = null;
  hoverPreviewProtectUntil = 0;
  const windowToClose = hoverPreviewWindow;
  hoverPreviewWindow = null;
  hoverPreviewItemId = null;
  if (windowToClose && !windowToClose.isDestroyed()) windowToClose.close();
  return true;
}

function closeStagingPreviewWindow() {
  const windowToClose = previewWindow;
  previewWindow = null;
  previewItemId = null;
  if (windowToClose && !windowToClose.isDestroyed()) windowToClose.close();
  return true;
}

function closeAllPreviewWindows() {
  closeHoverPreviewWindow();
  closeStagingPreviewWindow();
  return true;
}

function attachPreviewWindowGuards(candidate) {
  candidate.setMenuBarVisibility(false);
  candidate.setAlwaysOnTop(true, 'floating');
  candidate.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  candidate.webContents.on('will-navigate', (event) => event.preventDefault());
}

async function showHoverPreviewWindow(id) {
  try {
    if (!canShowHoverPreview()) return { ok: false, error: '窗口不可预览' };
    if (isPreviewWindowOpen(previewWindow)) return { ok: true, skipped: true };
    const item = await getStagingStore().getItem(String(id));
    if (!item || !['image', 'text', 'file'].includes(item.type)) return { ok: false, error: '暂存项不存在' };
    hoverPreviewItemId = item.id;
    hoverPreviewWantedId = item.id;
    const bounds = getHoverPreviewBounds(item);
    const { side, ...windowBounds } = bounds;
    if (!hoverPreviewWindow || hoverPreviewWindow.isDestroyed()) {
      const candidate = new BrowserWindow({
        ...windowBounds,
        title: item.type === 'text' ? '文字预览' : item.type === 'file' ? `文件 · ${item.name}` : `图片预览 · ${item.name}`,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        roundedCorners: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        webPreferences: {
          preload: path.join(__dirname, 'src', 'preview-preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
      hoverPreviewWindow = candidate;
      attachPreviewWindowGuards(candidate);
      candidate.setAlwaysOnTop(true, 'pop-up-menu');
      candidate.once('ready-to-show', () => {
        if (!candidate.isDestroyed()) candidate.showInactive();
      });
      candidate.on('closed', () => {
        if (hoverPreviewWindow === candidate) {
          hoverPreviewWindow = null;
          hoverPreviewItemId = null;
        }
      });
      await candidate.loadFile(path.join(__dirname, 'src', 'preview.html'), { query: { mode: 'hover' } });
    } else {
      hoverPreviewWindow.setBounds(windowBounds);
      hoverPreviewWindow.webContents.send('preview:refresh');
      if (!hoverPreviewWindow.isVisible()) hoverPreviewWindow.showInactive();
    }
    hoverPreviewProtectUntil = Date.now() + 280;
    return { ok: true, bounds, itemType: item.type };
  } catch (error) {
    closeHoverPreviewWindow();
    return { ok: false, error: getStagingError(error, '无法打开侧边预览') };
  }
}

function scheduleHoverPreview(id, rect) {
  const targetId = String(id ?? '');
  if (rect && Number.isFinite(Number(rect.x)) && Number.isFinite(Number(rect.y))) {
    hoverAnchorRect = {
      x: Number(rect.x),
      y: Number(rect.y),
      width: Number(rect.width) || 0,
      height: Number(rect.height) || 0,
    };
  }
  hoverPreviewWantedId = targetId;
  clearTimeout(hoverPreviewHideTimer);
  clearTimeout(hoverPreviewShowTimer);
  const delayMs = qaOutputDirectory ? 0 : HOVER_PREVIEW_OPEN_DELAY;
  hoverPreviewShowTimer = setTimeout(() => {
    if (hoverPreviewWantedId !== targetId) return;
    void showHoverPreviewWindow(targetId);
  }, delayMs);
  return { ok: true };
}

function scheduleHideHoverPreview() {
  clearTimeout(hoverPreviewHideTimer);
  const delayMs = qaOutputDirectory ? 0 : HOVER_PREVIEW_CLOSE_DELAY;
  hoverPreviewHideTimer = setTimeout(() => {
    if (shouldKeepHoverPreview()) {
      if (!qaOutputDirectory) scheduleHideHoverPreview();
      return;
    }
    closeHoverPreviewWindow();
  }, delayMs);
  return true;
}

function keepHoverPreview() {
  if (hoverPreviewItemId) hoverPreviewWantedId = hoverPreviewItemId;
  hoverPreviewProtectUntil = Date.now() + 160;
  clearTimeout(hoverPreviewHideTimer);
  return true;
}

async function openStagingPreviewWindow(id) {
  try {
    const item = await getStagingStore().getItem(String(id));
    if (item?.type === 'file') return openStagedFile(item.id);
    if (!item || !['image', 'text'].includes(item.type)) return { ok: false, error: '暂存项不存在' };
    closeHoverPreviewWindow();
    const bounds = getPreviewBounds(item);
    closeStagingPreviewWindow();
    previewItemId = item.id;
    const candidate = new BrowserWindow({
      ...bounds,
      minWidth: Math.min(PREVIEW_MIN_WIDTH, bounds.width),
      minHeight: Math.min(PREVIEW_MIN_HEIGHT, bounds.height),
      title: item.type === 'text' ? '文字预览' : `图片预览 · ${item.name}`,
      icon: path.join(__dirname, 'assets', 'icon.png'),
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      roundedCorners: true,
      resizable: true,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'src', 'preview-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    previewWindow = candidate;
    attachPreviewWindowGuards(candidate);
    candidate.once('ready-to-show', () => {
      if (!candidate.isDestroyed()) {
        candidate.show();
        candidate.focus();
      }
    });
    candidate.on('closed', () => {
      if (previewWindow === candidate) {
        previewWindow = null;
        previewItemId = null;
      }
    });
    await candidate.loadFile(path.join(__dirname, 'src', 'preview.html'));
    return {
      ok: true,
      bounds,
      itemType: item.type,
      sourceSize: item.type === 'image'
        ? { width: item.width, height: item.height }
        : { width: bounds.width, height: bounds.height },
    };
  } catch (error) {
    closeStagingPreviewWindow();
    return { ok: false, error: getStagingError(error, '无法打开预览') };
  }
}

function isClickPreviewSender(event) {
  return Boolean(
    previewWindow
    && !previewWindow.isDestroyed()
    && event.sender === previewWindow.webContents,
  );
}

function isHoverPreviewSender(event) {
  return Boolean(
    hoverPreviewWindow
    && !hoverPreviewWindow.isDestroyed()
    && event.sender === hoverPreviewWindow.webContents,
  );
}

function isPreviewSender(event) {
  return isClickPreviewSender(event) || isHoverPreviewSender(event);
}

async function getPreviewData(event) {
  const id = isHoverPreviewSender(event) ? hoverPreviewItemId : previewItemId;
  const item = id ? await getStagingStore().getItem(id) : null;
  if (!item || !['image', 'text', 'file'].includes(item.type)) return { ok: false, error: '暂存项不存在' };
  return { ok: true, item: serializeStagingItem(item) };
}

async function performStagingContextAction(action, id) {
  const item = await getStagingStore().getItem(String(id));
  if (!item) return { ok: false, action, error: '暂存项不存在' };
  if (action === 'preview' || action === 'open') {
    if (item.type === 'file') return { ...(await openStagedFile(item.id)), action: 'open' };
    if (!['image', 'text'].includes(item.type)) return { ok: false, action, error: '无法预览该暂存项' };
    return { ...(await openStagingPreviewWindow(item.id)), action };
  }
  if (action === 'reveal') return { ...(await revealStagedFile(item.id)), action };
  if (action === 'copy') return { ...(await copyStagingItem(item.id)), action };
  if (action === 'save') {
    const result = item.type === 'image'
      ? await saveStagingImage(item.id)
      : item.type === 'file'
        ? await saveStagingFile(item.id)
        : await saveStagingText(item.id);
    return { ...result, action };
  }
  if (action === 'delete') {
    await getStagingStore().remove(item.id);
    if (previewItemId === item.id) closeStagingPreviewWindow();
    if (hoverPreviewItemId === item.id) closeHoverPreviewWindow();
    return getStagingSnapshot({ action });
  }
  return { ok: false, action, error: '不支持的暂存操作' };
}

async function showStagingContextMenu(id) {
  const item = await getStagingStore().getItem(String(id));
  if (!item || !mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: '暂存项不存在' };
  }
  return new Promise((resolve) => {
    let actionStarted = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const run = (action) => {
      actionStarted = true;
      void performStagingContextAction(action, item.id).then(finish);
    };
    const template = item.type === 'file' ? [
      { label: '打开', click: () => run('open') },
      { label: '复制路径', click: () => run('copy') },
      { label: '在文件夹中显示', click: () => run('reveal') },
      { label: '另存副本…', click: () => run('save') },
      { type: 'separator' },
      { label: '删除暂存项', click: () => run('delete') },
    ] : item.type === 'image' ? [
      { label: '悬浮预览', click: () => run('preview') },
      { label: '复制图片', click: () => run('copy') },
      { label: '下载 / 另存图片…', click: () => run('save') },
      { type: 'separator' },
      { label: '删除暂存项', click: () => run('delete') },
    ] : [
      { label: '悬浮预览', click: () => run('preview') },
      { label: '复制文字', click: () => run('copy') },
      { label: '另存文字…', click: () => run('save') },
      { type: 'separator' },
      { label: '删除暂存项', click: () => run('delete') },
    ];
    Menu.buildFromTemplate(template).popup({
      window: mainWindow,
      callback: () => {
        if (!actionStarted) finish({ ok: false, canceled: true });
      },
    });
  });
}

function registerStagingProtocol() {
  protocol.handle(STAGING_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'item') return new Response('', { status: 404 });
      const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return new Response('', { status: 400 });
      const kind = url.searchParams.get('kind') === 'thumbnail' ? 'thumbnail' : 'original';
      const imagePath = await getStagingStore().getImagePath(id, kind);
      if (!imagePath) return new Response('', { status: 404 });
      return net.fetch(pathToFileURL(imagePath).toString());
    } catch {
      return new Response('', { status: 404 });
    }
  });
}

function getLaunchAtLoginTarget() {
  const portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE;
  if (portableExecutable && path.isAbsolute(portableExecutable)) {
    return { path: portableExecutable, args: [], targetType: 'portable' };
  }
  if (app.isPackaged) {
    return { path: process.execPath, args: [], targetType: 'packaged' };
  }
  // Development builds need the project path because process.execPath points
  // to electron.exe rather than to this application.
  return { path: process.execPath, args: [`"${app.getAppPath()}"`], targetType: 'development' };
}

function getLaunchAtLoginState() {
  if (process.platform !== 'win32') {
    return { supported: false, enabled: false, targetType: 'unsupported' };
  }

  const { path: executablePath, args, targetType } = getLaunchAtLoginTarget();
  if (qaOutputDirectory) {
    return { supported: true, enabled: qaLaunchAtLoginEnabled, targetType };
  }

  try {
    const settings = app.getLoginItemSettings({ path: executablePath, args });
    const resolved = resolveLaunchAtLoginState(
      settings,
      { path: executablePath, args },
      APP_NAME,
    );
    return {
      supported: true,
      enabled: resolved.enabled,
      registered: resolved.registered,
      targetType,
    };
  } catch {
    return {
      supported: true,
      enabled: false,
      targetType,
      error: '无法读取 Windows 开机自启动状态',
    };
  }
}

function setLaunchAtLogin(nextEnabled) {
  const desired = Boolean(nextEnabled);
  const current = getLaunchAtLoginState();
  if (!current.supported) return current;

  if (qaOutputDirectory) {
    qaLaunchAtLoginEnabled = desired;
    return getLaunchAtLoginState();
  }

  try {
    const { path: executablePath, args, targetType } = getLaunchAtLoginTarget();
    const settings = {
      openAtLogin: desired,
      path: executablePath,
      args,
      name: APP_NAME,
    };
    if (desired) settings.enabled = true;
    app.setLoginItemSettings(settings);
    const updated = getLaunchAtLoginState();
    if (updated.enabled !== desired) {
      return {
        ...updated,
        targetType,
        error: 'Windows 未能更新开机自启动设置',
      };
    }
    return updated;
  } catch {
    return {
      ...getLaunchAtLoginState(),
      error: '无法修改开机自启动设置',
    };
  }
}

function readWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(getStateFile(), 'utf8'));
    isPinned = saved.pinned !== false;
    dockedEdge = VALID_EDGES.has(saved.dockedEdge) ? saved.dockedEdge : null;
    // V2 only stored bounds from its larger 430×520 window. Treat an explicit
    // `size` field as the V3 opt-in so upgrades start at the new compact size.
    currentSize = saved.size ? clampSize(saved.size) : { ...DEFAULT_SIZE };
    if (currentSize.width === 300 || currentSize.width === 330) currentSize = { ...currentSize, width: DEFAULT_SIZE.width };
    if (currentSize.height === 200 || currentSize.height === 230) currentSize = { ...currentSize, height: DEFAULT_SIZE.height };
    persistedNormalBounds = saved.normalBounds ?? saved.bounds ?? null;
  } catch {
    isPinned = true;
    dockedEdge = null;
    currentSize = { ...DEFAULT_SIZE };
    persistedNormalBounds = null;
  }
}

function getDefaultNormalBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - currentSize.width - 36,
    y: workArea.y + Math.round((workArea.height - currentSize.height) / 2),
    ...currentSize,
  };
}

function clampNormalBounds(bounds) {
  const candidate = {
    x: Number.isFinite(bounds?.x) ? bounds.x : 0,
    y: Number.isFinite(bounds?.y) ? bounds.y : 0,
    ...currentSize,
  };
  const { workArea } = screen.getDisplayMatching(candidate);
  return {
    x: Math.min(Math.max(candidate.x, workArea.x), workArea.x + workArea.width - currentSize.width),
    y: Math.min(Math.max(candidate.y, workArea.y), workArea.y + workArea.height - currentSize.height),
    ...currentSize,
  };
}

function getDockedBounds(edge, sourceBounds = normalBounds) {
  const base = clampNormalBounds(sourceBounds ?? getDefaultNormalBounds());
  const { workArea } = screen.getDisplayMatching(base);
  const bounds = { ...base };

  if (edge === 'left') bounds.x = workArea.x - currentSize.width + EDGE_REVEAL;
  if (edge === 'right') bounds.x = workArea.x + workArea.width - EDGE_REVEAL;
  if (edge === 'top') bounds.y = workArea.y - currentSize.height + EDGE_REVEAL;
  if (edge === 'bottom') bounds.y = workArea.y + workArea.height - EDGE_REVEAL;
  return bounds;
}

function getEdgePreviewBounds(edge, sourceBounds = normalBounds) {
  const base = clampNormalBounds(sourceBounds ?? getDefaultNormalBounds());
  const { workArea } = screen.getDisplayMatching(base);
  const bounds = { ...base };

  if (edge === 'left') bounds.x = workArea.x;
  if (edge === 'right') bounds.x = workArea.x + workArea.width - currentSize.width;
  if (edge === 'top') bounds.y = workArea.y;
  if (edge === 'bottom') bounds.y = workArea.y + workArea.height - currentSize.height;
  return bounds;
}

function pointIsInsideBounds(point, bounds) {
  return point.x >= bounds.x
    && point.x < bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y < bounds.y + bounds.height;
}

function getEdgeHandleBounds(edge, sourceBounds = normalBounds) {
  const base = clampNormalBounds(sourceBounds ?? getDefaultNormalBounds());
  const { workArea } = screen.getDisplayMatching(base);
  const workAreaRight = workArea.x + workArea.width;
  const workAreaBottom = workArea.y + workArea.height;

  if (edge === 'left' || edge === 'right') {
    const height = Math.min(EDGE_HANDLE_LENGTH, currentSize.height);
    return {
      x: edge === 'left' ? workArea.x : workAreaRight - EDGE_REVEAL,
      y: base.y + Math.round((currentSize.height - height) / 2),
      width: EDGE_REVEAL,
      height,
    };
  }

  const width = Math.min(EDGE_HANDLE_LENGTH, currentSize.width);
  return {
    x: base.x + Math.round((currentSize.width - width) / 2),
    y: edge === 'top' ? workArea.y : workAreaBottom - EDGE_REVEAL,
    width,
    height: EDGE_REVEAL,
  };
}

function getRestoredBounds(edge) {
  const base = clampNormalBounds(normalBounds ?? getDefaultNormalBounds());
  const { workArea } = screen.getDisplayMatching(base);

  if (edge === 'left') base.x = workArea.x + RESTORE_INSET;
  if (edge === 'right') base.x = workArea.x + workArea.width - currentSize.width - RESTORE_INSET;
  if (edge === 'top') base.y = workArea.y + RESTORE_INSET;
  if (edge === 'bottom') base.y = workArea.y + workArea.height - currentSize.height - RESTORE_INSET;
  return clampNormalBounds(base);
}

function getInitialBounds() {
  normalBounds = persistedNormalBounds
    ? clampNormalBounds(persistedNormalBounds)
    : getDefaultNormalBounds();
  return dockedEdge ? getDockedBounds(dockedEdge, normalBounds) : normalBounds;
}

function writeWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!dockedEdge && !isProgrammaticMove) normalBounds = clampNormalBounds(mainWindow.getBounds());

  try {
    fs.mkdirSync(path.dirname(getStateFile()), { recursive: true });
    fs.writeFileSync(getStateFile(), JSON.stringify({
      normalBounds: normalBounds ?? getDefaultNormalBounds(),
      size: currentSize,
      dockedEdge,
      pinned: isPinned,
    }, null, 2), 'utf8');
  } catch (error) {
    console.error('无法保存窗口状态：', error);
  }
}

function scheduleStateWrite() {
  clearTimeout(stateWriteTimer);
  stateWriteTimer = setTimeout(writeWindowState, 160);
}

function boundsAreClose(first, second, tolerance = 2) {
  if (!first || !second) return false;
  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(first[key] - second[key]) <= tolerance);
}

function finishProgrammaticMove() {
  clearTimeout(programmaticMoveTimer);
  isProgrammaticMove = false;
  programmaticMoveTarget = null;
}

function setManagedBounds(bounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  isProgrammaticMove = true;
  programmaticMoveTarget = { ...bounds };
  clearTimeout(manualMoveFinishTimer);
  clearTimeout(programmaticMoveTimer);
  mainWindow.setBounds(bounds, false);
  programmaticMoveTimer = setTimeout(finishProgrammaticMove, 220);
}

function getPublicWindowState() {
  return {
    dockedEdge,
    edgePreviewed: isEdgePreviewed,
    edgeReveal: EDGE_REVEAL,
    pinned: isPinned,
    shortcut: 'Ctrl + Shift + Space',
    shortcutRegistered,
    size: { ...currentSize },
    sizeLimits: { ...SIZE_LIMITS },
    visible: Boolean(mainWindow?.isVisible()),
  };
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('window:state-changed', getPublicWindowState());
}

function refreshTransparentWindowSurface() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearTimeout(edgeSurfaceRefreshTimer);
  mainWindow.webContents.invalidate?.();
  edgeSurfaceRefreshTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Re-emit the current state after the native bounds move. On Windows,
    // transparent frameless windows can otherwise keep the old fully
    // transparent surface when most of the window moves back on-screen.
    sendWindowState();
    mainWindow.webContents.invalidate?.();
  }, 80);
}

function tracePointerQa(label) {
  if (!userDataOverrideDirectory || !mainWindow || mainWindow.isDestroyed()) return;
  setTimeout(async () => {
    try {
      const renderer = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const appRoot = document.querySelector('#app');
          const shell = document.querySelector('.widget-shell');
          const handle = document.querySelector('#edgeHandle');
          return {
            edge: appRoot?.dataset.edge ?? null,
            hiddenClass: Boolean(appRoot?.classList.contains('is-edge-hidden')),
            previewClass: Boolean(appRoot?.classList.contains('is-edge-preview')),
            shellOpacity: shell ? getComputedStyle(shell).opacity : null,
            shellVisibility: shell ? getComputedStyle(shell).visibility : null,
            shellBackground: shell ? getComputedStyle(shell).backgroundColor : null,
            handleDisplay: handle ? getComputedStyle(handle).display : null,
          };
        })()
      `);
      fs.appendFileSync(path.join(userDataOverrideDirectory, 'pointer-trace.jsonl'), `${JSON.stringify({
        label,
        at: Date.now(),
        dockedEdge,
        edgePreviewed: isEdgePreviewed,
        cursor: screen.getCursorScreenPoint(),
        bounds: mainWindow.getBounds(),
        renderer,
      })}\n`, 'utf8');
    } catch (error) {
      console.error('无法记录指针 QA：', error);
    }
  }, 180);
}

function detectNearestEdge(bounds, cursorPoint = screen.getCursorScreenPoint()) {
  const { workArea } = screen.getDisplayNearestPoint(cursorPoint);
  const right = workArea.x + workArea.width;
  const bottom = workArea.y + workArea.height;
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;
  const distances = [
    ['left', Math.min(Math.abs(cursorPoint.x - workArea.x), bounds.x <= workArea.x ? 0 : bounds.x - workArea.x)],
    ['right', Math.min(Math.abs(cursorPoint.x - right), boundsRight >= right ? 0 : right - boundsRight)],
    ['top', Math.min(Math.abs(cursorPoint.y - workArea.y), bounds.y <= workArea.y ? 0 : bounds.y - workArea.y)],
    ['bottom', Math.min(Math.abs(cursorPoint.y - bottom), boundsBottom >= bottom ? 0 : bottom - boundsBottom)],
  ].sort((first, second) => first[1] - second[1]);
  return distances[0][1] <= EDGE_THRESHOLD ? distances[0][0] : null;
}

function dockToEdge(edge) {
  if (!VALID_EDGES.has(edge) || !mainWindow || mainWindow.isDestroyed()) return getPublicWindowState();
  closeAllPreviewWindows();
  if (!dockedEdge) normalBounds = mainWindow.getBounds();
  dockedEdge = edge;
  isEdgePreviewed = false;
  clearTimeout(edgePreviewShowTimer);
  resetEdgeHoverTracking({ armed: false });
  sendWindowState();
  setManagedBounds(getDockedBounds(edge, normalBounds));
  scheduleStateWrite();
  rebuildTrayMenu();
  return getPublicWindowState();
}

function restoreFromEdge({ focus = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return getPublicWindowState();
  if (dockedEdge) {
    const restored = getRestoredBounds(dockedEdge);
    dockedEdge = null;
    isEdgePreviewed = false;
    clearTimeout(edgePreviewShowTimer);
    resetEdgeHoverTracking({ armed: false });
    normalBounds = restored;
    sendWindowState();
    setManagedBounds(restored);
    scheduleStateWrite();
  }
  focus ? (mainWindow.show(), mainWindow.focus()) : mainWindow.showInactive();
  rebuildTrayMenu();
  return getPublicWindowState();
}

function previewFromEdge() {
  if (!mainWindow || mainWindow.isDestroyed() || !dockedEdge) return getPublicWindowState();
  isEdgePreviewed = true;
  edgeHoverEnteredAt = 0;
  edgeHoverLeftAt = 0;
  clearTimeout(edgePreviewShowTimer);
  mainWindow.hide();
  setManagedBounds(getEdgePreviewBounds(dockedEdge, normalBounds));
  sendWindowState();
  refreshTransparentWindowSurface();
  edgePreviewShowTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !dockedEdge || !isEdgePreviewed) return;
    mainWindow.showInactive();
    mainWindow.moveTop();
    sendWindowState();
    mainWindow.webContents.invalidate?.();
    tracePointerQa('preview');
  }, 16);
  return getPublicWindowState();
}

function collapseEdgePreview() {
  if (!mainWindow || mainWindow.isDestroyed() || !dockedEdge || !isEdgePreviewed) {
    return getPublicWindowState();
  }
  closeAllPreviewWindows();
  clearTimeout(edgePreviewShowTimer);
  mainWindow.hide();
  isEdgePreviewed = false;
  resetEdgeHoverTracking({ armed: false });
  sendWindowState();
  setManagedBounds(getDockedBounds(dockedEdge, normalBounds));
  refreshTransparentWindowSurface();
  edgePreviewShowTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !dockedEdge || isEdgePreviewed) return;
    mainWindow.showInactive();
    mainWindow.moveTop();
    sendWindowState();
    mainWindow.webContents.invalidate?.();
  }, 16);
  tracePointerQa('collapse');
  return getPublicWindowState();
}

function resetEdgeHoverTracking({ armed = false } = {}) {
  edgeHoverEnteredAt = 0;
  edgeHoverLeftAt = 0;
  edgeHoverArmed = armed;
}

function processEdgeHoverPoint(point, now = Date.now()) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || !dockedEdge) {
    resetEdgeHoverTracking({ armed: false });
    return getPublicWindowState();
  }

  if (!isEdgePreviewed) {
    edgeHoverLeftAt = 0;
    const isOverHandle = pointIsInsideBounds(point, getEdgeHandleBounds(dockedEdge, normalBounds));

    if (!isOverHandle) {
      edgeHoverArmed = true;
      edgeHoverEnteredAt = 0;
      return getPublicWindowState();
    }

    if (!edgeHoverArmed) return getPublicWindowState();
    if (!edgeHoverEnteredAt) {
      edgeHoverEnteredAt = now;
      return getPublicWindowState();
    }
    if (now - edgeHoverEnteredAt >= EDGE_HOVER_OPEN_DELAY) previewFromEdge();
    return getPublicWindowState();
  }

  edgeHoverEnteredAt = 0;
  const isOverExpandedWindow = pointIsInsideBounds(point, mainWindow.getBounds());
  if (isOverExpandedWindow || isPreviewWindowOpen(previewWindow) || isCursorOverPreviewWindows(point)) {
    edgeHoverLeftAt = 0;
    return getPublicWindowState();
  }

  if (!edgeHoverLeftAt) {
    edgeHoverLeftAt = now;
    return getPublicWindowState();
  }
  if (now - edgeHoverLeftAt >= EDGE_HOVER_CLOSE_DELAY) collapseEdgePreview();
  return getPublicWindowState();
}

function startEdgeHoverMonitor() {
  clearInterval(edgeHoverMonitorTimer);
  if (qaOutputDirectory) return;
  edgeHoverMonitorTimer = setInterval(() => {
    processEdgeHoverPoint(screen.getCursorScreenPoint());
  }, EDGE_HOVER_POLL_INTERVAL);
  edgeHoverMonitorTimer.unref?.();
}

function setWindowSize(requestedSize) {
  if (!mainWindow || mainWindow.isDestroyed()) return getPublicWindowState();
  const nextSize = clampSize(requestedSize);
  const oldBounds = dockedEdge
    ? clampNormalBounds(normalBounds ?? getDefaultNormalBounds())
    : mainWindow.getBounds();

  currentSize = nextSize;
  const centered = {
    x: oldBounds.x + Math.round((oldBounds.width - nextSize.width) / 2),
    y: oldBounds.y + Math.round((oldBounds.height - nextSize.height) / 2),
    ...nextSize,
  };
  normalBounds = clampNormalBounds(centered);
  const target = dockedEdge
    ? isEdgePreviewed
      ? getEdgePreviewBounds(dockedEdge, normalBounds)
      : getDockedBounds(dockedEdge, normalBounds)
    : normalBounds;
  setManagedBounds(target);
  sendWindowState();
  scheduleStateWrite();
  return getPublicWindowState();
}

function undockForManualMove(bounds = mainWindow?.getBounds()) {
  if (!mainWindow || mainWindow.isDestroyed() || !dockedEdge || !bounds) return false;
  dockedEdge = null;
  isEdgePreviewed = false;
  clearTimeout(edgePreviewShowTimer);
  resetEdgeHoverTracking({ armed: false });
  normalBounds = { ...bounds };
  sendWindowState();
  refreshTransparentWindowSurface();
  scheduleStateWrite();
  rebuildTrayMenu();
  return true;
}

function handleNativeWindowMove(bounds = mainWindow?.getBounds()) {
  if (!mainWindow || mainWindow.isDestroyed() || !bounds) return false;

  // setBounds() also emits move events. Ignore only the exact managed target;
  // a different bounds while the timer is active means the user has already
  // started dragging the frameless window and must take ownership immediately.
  if (isProgrammaticMove && boundsAreClose(bounds, programmaticMoveTarget)) return false;
  if (isProgrammaticMove) finishProgrammaticMove();

  const expected = dockedEdge
    ? (isEdgePreviewed ? getEdgePreviewBounds(dockedEdge, normalBounds) : getDockedBounds(dockedEdge, normalBounds))
    : (normalBounds ?? bounds);
  const draggedAway = !boundsAreClose(bounds, expected, 8);
  if (!draggedAway) return false;

  const undocked = undockForManualMove(bounds);
  closeHoverPreviewWindow();
  normalBounds = { ...bounds };
  scheduleStateWrite();
  scheduleManualMoveFinished();
  return undocked;
}

function handleManualMoveFinished(cursorPoint = screen.getCursorScreenPoint()) {
  if (!mainWindow || mainWindow.isDestroyed() || isProgrammaticMove || dockedEdge) return;
  if (isPreviewWindowOpen(previewWindow) || isPreviewWindowOpen(hoverPreviewWindow)) return;
  normalBounds = mainWindow.getBounds();
  const edge = detectNearestEdge(normalBounds, cursorPoint);
  edge ? dockToEdge(edge) : scheduleStateWrite();
}

function scheduleManualMoveFinished() {
  clearTimeout(manualMoveFinishTimer);
  manualMoveFinishTimer = setTimeout(() => handleManualMoveFinished(), 170);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...getInitialBounds(),
    minWidth: SIZE_LIMITS.minWidth,
    minHeight: SIZE_LIMITS.minHeight,
    maxWidth: SIZE_LIMITS.maxWidth,
    maxHeight: SIZE_LIMITS.maxHeight,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: true,
    roundedCorners: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: isPinned,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAlwaysOnTop(isPinned, 'floating');
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.showInactive();
    scheduleBackgroundServices();
  });
  mainWindow.on('move', () => handleNativeWindowMove());
  mainWindow.on('moved', () => {
    clearTimeout(manualMoveFinishTimer);
    handleNativeWindowMove();
    clearTimeout(manualMoveFinishTimer);
    handleManualMoveFinished();
  });
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      closeAllPreviewWindows();
      mainWindow.hide();
      rebuildTrayMenu();
    }
  });
  mainWindow.on('closed', () => {
    closeAllPreviewWindows();
    mainWindow = null;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    sendWindowState();
    if (pendingCreateItem) {
      mainWindow.webContents.send('items:create-request');
      pendingCreateItem = false;
    }
    if (qaOutputDirectory) runVisualQa(qaOutputDirectory);
  });
}

function showWindow({ focus = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  restoreFromEdge({ focus });
  sendWindowState();
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  if (dockedEdge || !mainWindow.isVisible()) return showWindow();
  closeAllPreviewWindows();
  mainWindow.hide();
  rebuildTrayMenu();
}

function requestNewItem() {
  pendingCreateItem = true;
  showWindow();
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.send('items:create-request');
    pendingCreateItem = false;
  }
}

function setPinned(nextPinned) {
  isPinned = Boolean(nextPinned);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(isPinned, 'floating');
    sendWindowState();
  }
  scheduleStateWrite();
  rebuildTrayMenu();
  return getPublicWindowState();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const visible = Boolean(mainWindow?.isVisible());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: dockedEdge || !visible ? '打开桌面便签' : '隐藏到托盘', click: toggleWindow },
    { label: '新建待办', click: requestNewItem },
    { type: 'separator' },
    { label: '始终置顶', type: 'checkbox', checked: isPinned, click: (item) => setPinned(item.checked) },
    { label: shortcutRegistered ? '快捷键：Ctrl + Shift + Space' : '快捷键被其他应用占用', enabled: false },
    { type: 'separator' },
    {
      label: '退出桌面便签',
      click: () => {
        isQuitting = true;
        writeWindowState();
        app.quit();
      },
    },
  ]));
}

function createTray() {
  if (tray && !tray.isDestroyed()) return;
  const trayImage = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(trayImage.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')) : trayImage);
  tray.setToolTip(`${APP_NAME} · Ctrl + Shift + Space`);
  tray.on('click', toggleWindow);
  tray.on('double-click', requestNewItem);
  rebuildTrayMenu();
}

function startBackgroundServices() {
  if (backgroundServicesStarted || isQuitting) return;
  backgroundServicesStarted = true;
  startEdgeHoverMonitor();
  createTray();
  shortcutRegistered = globalShortcut.register(SHORTCUT, toggleWindow);
  rebuildTrayMenu();
}

function scheduleBackgroundServices() {
  if (backgroundServicesStarted || isQuitting) return;
  clearTimeout(backgroundServicesTimer);
  backgroundServicesTimer = setTimeout(startBackgroundServices, 120);
}

function registerIpc() {
  ipcMain.handle('window:get-state', () => getPublicWindowState());
  ipcMain.handle('window:set-pinned', (_event, next) => setPinned(next));
  ipcMain.handle('window:set-size', (_event, size) => setWindowSize(size));
  ipcMain.handle('window:restore-edge', () => restoreFromEdge());
  ipcMain.handle('system:get-launch-at-login', () => getLaunchAtLoginState());
  ipcMain.handle('system:set-launch-at-login', (_event, next) => setLaunchAtLogin(next));
  ipcMain.handle('staging:list', async () => {
    try {
      return await getStagingSnapshot();
    } catch (error) {
      return { ok: false, error: getStagingError(error, '无法读取暂存区') };
    }
  });
  ipcMain.handle('staging:create-text', (_event, text) => runStagingMutation(
    () => getStagingStore().createText(String(text ?? '')),
    { imported: 1, source: 'manual-text' },
  ));
  ipcMain.handle('staging:update-text', (_event, payload) => runStagingMutation(
    () => getStagingStore().updateText(String(payload?.id ?? ''), String(payload?.text ?? '')),
  ));
  ipcMain.handle('staging:reorder', (_event, orderedIds) => runStagingMutation(
    () => getStagingStore().reorder(orderedIds),
  ));
  ipcMain.handle('staging:delete', async (_event, id) => {
    const targetId = String(id ?? '');
    const result = await runStagingMutation(() => getStagingStore().remove(targetId));
    if (result.ok && previewItemId === targetId) closeStagingPreviewWindow();
    if (result.ok && hoverPreviewItemId === targetId) closeHoverPreviewWindow();
    return result;
  });
  ipcMain.handle('staging:clear', async () => {
    try {
      const removed = await getStagingStore().clear();
      closeAllPreviewWindows();
      return getStagingSnapshot({ removed });
    } catch (error) {
      return { ok: false, error: getStagingError(error, '无法清空暂存区') };
    }
  });
  ipcMain.handle('staging:import-files', (_event, payloads) => importStagingPayloads(payloads));
  ipcMain.handle('staging:import-paths', (_event, filePaths) => importStagingPaths(filePaths));
  ipcMain.handle('staging:pick-images', () => chooseStagingImages());
  ipcMain.handle('staging:open-file', (_event, id) => openStagedFile(id));
  ipcMain.handle('staging:paste', () => pasteToStaging());
  ipcMain.handle('staging:copy', (_event, id) => copyStagingItem(id));
  ipcMain.handle('staging:save-image', (_event, id) => saveStagingImage(id));
  ipcMain.handle('staging:open-preview', (_event, id) => openStagingPreviewWindow(id));
  ipcMain.handle('staging:close-preview', () => closeStagingPreviewWindow());
  ipcMain.handle('staging:hover-preview', (_event, id, rect) => scheduleHoverPreview(id, rect));
  ipcMain.handle('staging:hide-hover-preview', () => scheduleHideHoverPreview());
  ipcMain.handle('staging:keep-hover-preview', () => keepHoverPreview());
  ipcMain.handle('staging:context-menu', (_event, id) => showStagingContextMenu(id));
  ipcMain.handle('preview:get-data', (event) => (
    isPreviewSender(event)
      ? getPreviewData(event)
      : { ok: false, error: '无权读取预览' }
  ));
  ipcMain.handle('preview:close', (event) => {
    if (isHoverPreviewSender(event)) {
      setImmediate(closeHoverPreviewWindow);
      return true;
    }
    if (!isClickPreviewSender(event)) return false;
    setImmediate(closeStagingPreviewWindow);
    return true;
  });
  ipcMain.handle('preview:open-full', async (event) => {
    if (!isHoverPreviewSender(event) || !hoverPreviewItemId) return { ok: false, error: '侧边预览已关闭' };
    const item = await getStagingStore().getItem(hoverPreviewItemId);
    if (item?.type === 'file') {
      closeHoverPreviewWindow();
      return openStagedFile(item.id);
    }
    return openStagingPreviewWindow(hoverPreviewItemId);
  });
  ipcMain.handle('preview:copy', (event) => (
    isClickPreviewSender(event) && previewItemId
      ? copyStagingItem(previewItemId)
      : { ok: false, error: '预览已关闭' }
  ));
  ipcMain.handle('preview:save', async (event) => {
    if (!isClickPreviewSender(event) || !previewItemId) return { ok: false, error: '预览已关闭' };
    const item = await getStagingStore().getItem(previewItemId);
    if (!item) return { ok: false, error: '暂存项不存在' };
    return item.type === 'image'
      ? saveStagingImage(item.id, previewWindow)
      : saveStagingText(item.id, previewWindow);
  });
  ipcMain.handle('window:hide', () => {
    closeAllPreviewWindows();
    mainWindow?.hide();
    rebuildTrayMenu();
    return true;
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function captureBrowserWindow(targetWindow, filePath) {
  if (!targetWindow || targetWindow.isDestroyed()) throw new Error('无法截取已关闭的窗口');
  const image = await targetWindow.webContents.capturePage();
  fs.writeFileSync(filePath, image.toPNG());
}

async function captureWindow(filePath) {
  return captureBrowserWindow(mainWindow, filePath);
}

function boundsExposeEdge(bounds, edge) {
  const { workArea } = screen.getDisplayMatching(normalBounds ?? bounds);
  const tolerance = 2;
  if (edge === 'left') return Math.abs(bounds.x + bounds.width - (workArea.x + EDGE_REVEAL)) <= tolerance;
  if (edge === 'right') return Math.abs(bounds.x - (workArea.x + workArea.width - EDGE_REVEAL)) <= tolerance;
  if (edge === 'top') return Math.abs(bounds.y + bounds.height - (workArea.y + EDGE_REVEAL)) <= tolerance;
  return Math.abs(bounds.y - (workArea.y + workArea.height - EDGE_REVEAL)) <= tolerance;
}

function edgeHandleFacesCenter(edge, style) {
  const zero = (value) => Math.abs(Number.parseFloat(value)) < 0.1;
  const rounded = (value) => Number.parseFloat(value) >= 8;
  if (edge === 'left') {
    return zero(style.topLeftRadius) && zero(style.bottomLeftRadius)
      && rounded(style.topRightRadius) && rounded(style.bottomRightRadius)
      && zero(style.borderLeftWidth);
  }
  if (edge === 'right') {
    return rounded(style.topLeftRadius) && rounded(style.bottomLeftRadius)
      && zero(style.topRightRadius) && zero(style.bottomRightRadius)
      && zero(style.borderRightWidth);
  }
  if (edge === 'top') {
    return zero(style.topLeftRadius) && zero(style.topRightRadius)
      && rounded(style.bottomLeftRadius) && rounded(style.bottomRightRadius)
      && zero(style.borderTopWidth);
  }
  return rounded(style.topLeftRadius) && rounded(style.topRightRadius)
    && zero(style.bottomLeftRadius) && zero(style.bottomRightRadius)
    && zero(style.borderBottomWidth);
}

async function runVisualQa(outputDirectory) {
  const qaDirectory = path.resolve(outputDirectory);
  try {
    fs.mkdirSync(qaDirectory, { recursive: true });
    restoreFromEdge({ focus: false });
    setWindowSize(DEFAULT_SIZE);
    await delay(300);

    const functional = await mainWindow.webContents.executeJavaScript('window.__desktopQa.runFunctionalChecks()');

    const layoutSignatures = [];
    const opacityRanges = [];
    for (const theme of ['gray', 'paper', 'graphite', 'glass', 'editorial', 'wabi']) {
      const signature = await mainWindow.webContents.executeJavaScript(
        `window.__desktopQa.setThemeAndMeasure('${theme}', 84)`,
      );
      layoutSignatures.push(signature);
      await delay(180);
      await captureWindow(path.join(qaDirectory, `theme-${theme}.png`));
      opacityRanges.push(await mainWindow.webContents.executeJavaScript(
        `window.__desktopQa.measureOpacityRange('${theme}')`,
      ));
    }
    const compactLayout = JSON.stringify(layoutSignatures.find((entry) => entry.theme === 'gray')?.metrics);
    const editorialLayout = JSON.stringify(layoutSignatures.find((entry) => entry.theme === 'editorial')?.metrics);
    const layoutsIdentical = layoutSignatures.every((entry) => {
      const expected = ['editorial', 'wabi'].includes(entry.theme) ? editorialLayout : compactLayout;
      return JSON.stringify(entry.metrics) === expected;
    });
    const stagingLayoutSignatures = [];
    for (const theme of ['gray', 'paper', 'graphite', 'glass', 'editorial', 'wabi']) {
      stagingLayoutSignatures.push(await mainWindow.webContents.executeJavaScript(
        `window.__desktopQa.measureStagingLayout('${theme}')`,
      ));
    }
    const firstStagingLayout = JSON.stringify(stagingLayoutSignatures[0].metrics);
    const stagingLayoutsIdentical = stagingLayoutSignatures.every(
      (entry) => JSON.stringify(entry.metrics) === firstStagingLayout,
    );
    const opacityRangesUnified = opacityRanges.every((entry) => entry.samples.every((sample) => (
      Math.abs(sample.panelAlpha - sample.opacity / 100) < 0.001
      && Math.abs(sample.surfaceAlpha - sample.opacity / 100) < 0.011
    )));

    await mainWindow.webContents.executeJavaScript("window.__desktopQa.openDirectTimePanel('graphite')");
    await delay(180);
    await captureWindow(path.join(qaDirectory, '05-direct-time-input.png'));
    await mainWindow.webContents.executeJavaScript('window.__desktopQa.closePanels()');

    await mainWindow.webContents.executeJavaScript("window.__desktopQa.openSettings('graphite')");
    await delay(180);
    await captureWindow(path.join(qaDirectory, '06-settings.png'));
    const launchAtLoginSettingVisible = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const content = document.querySelector('.settings-content');
        const row = document.querySelector('.startup-row');
        const toggle = document.querySelector('#launchAtLoginToggle');
        const hint = document.querySelector('#launchAtLoginHint');
        const switchControl = row?.querySelector('.switch');
        content.scrollTop = content.scrollHeight;
        const contentRect = content.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const switchRect = switchControl.getBoundingClientRect();
        return Boolean(
          !toggle.disabled
          && !toggle.checked
          && hint.textContent.includes('默认关闭')
          && rowRect.top >= contentRect.top - 1
          && rowRect.bottom <= contentRect.bottom + 1
          && Math.abs(switchRect.width - 31) <= 1
          && Math.abs(switchRect.height - 17) <= 1
        );
      })()
    `);
    await delay(100);
    await captureWindow(path.join(qaDirectory, '06b-settings-autostart.png'));
    const settingsBottomFocusState = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const panel = document.querySelector('#settingsPanel');
        const content = document.querySelector('.settings-content');
        const toggle = document.querySelector('#launchAtLoginToggle');
        const rect = content.getBoundingClientRect();
        toggle.focus();
        return {
          panelScrollTop: panel.scrollTop,
          contentScrollTop: content.scrollTop,
          contentMaxScroll: content.scrollHeight - content.clientHeight,
          wheelPoint: {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          },
        };
      })()
    `);
    mainWindow.webContents.sendInputEvent({
      type: 'mouseMove',
      ...settingsBottomFocusState.wheelPoint,
    });
    for (let index = 0; index < 8; index += 1) {
      mainWindow.webContents.sendInputEvent({
        type: 'mouseWheel',
        ...settingsBottomFocusState.wheelPoint,
        deltaY: 120,
        canScroll: true,
      });
      await delay(40);
    }
    await delay(160);
    const settingsScrolledUpState = await mainWindow.webContents.executeJavaScript(`
      (() => ({
        panelScrollTop: document.querySelector('#settingsPanel').scrollTop,
        contentScrollTop: document.querySelector('.settings-content').scrollTop,
      }))()
    `);
    await mainWindow.webContents.executeJavaScript('window.__desktopQa.closePanels()');
    await mainWindow.webContents.executeJavaScript("window.__desktopQa.openSettings('graphite')");
    await delay(180);
    const settingsReopenedState = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const panel = document.querySelector('#settingsPanel');
        const content = document.querySelector('.settings-content');
        const header = document.querySelector('#settingsPanel .overlay-header');
        const panelRect = panel.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        return {
          panelScrollTop: panel.scrollTop,
          contentScrollTop: content.scrollTop,
          headerVisible: headerRect.top >= panelRect.top - 1 && headerRect.bottom <= panelRect.bottom + 1,
        };
      })()
    `);
    const scrollIsAtOrigin = (value) => Math.abs(value) <= 1;
    const settingsReverseScrollWorks = settingsBottomFocusState.contentMaxScroll > 0
      && settingsBottomFocusState.contentScrollTop > 0
      && scrollIsAtOrigin(settingsBottomFocusState.panelScrollTop)
      && scrollIsAtOrigin(settingsScrolledUpState.panelScrollTop)
      && scrollIsAtOrigin(settingsScrolledUpState.contentScrollTop)
      && scrollIsAtOrigin(settingsReopenedState.panelScrollTop)
      && scrollIsAtOrigin(settingsReopenedState.contentScrollTop)
      && settingsReopenedState.headerVisible;
    await captureWindow(path.join(qaDirectory, '06c-settings-scroll-restored.png'));
    await mainWindow.webContents.executeJavaScript('window.__desktopQa.closePanels()');

    const stagingShowcaseCount = await mainWindow.webContents.executeJavaScript(
      "window.__desktopQa.openStagingShowcase('gray')",
    );
    await delay(260);
    const stagingVisualState = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const workspace = document.querySelector('#stagingWorkspace');
        const list = document.querySelector('#stagingList');
        const rows = [...document.querySelectorAll('.staging-row')];
        return {
          workspaceVisible: !workspace.hidden,
          rowCount: rows.length,
          reorderHandleCount: rows.filter((row) => row.querySelector('.staging-reorder')).length,
          imageCount: rows.filter((row) => row.dataset.kind === 'image').length,
          textEditorCount: rows.filter((row) => row.querySelector('.staging-text-editor')?.offsetParent).length,
          scrolls: list.scrollHeight > list.clientHeight,
          selectedTab: document.querySelector('#stagingTab').classList.contains('is-active'),
        };
      })()
    `);
    const stagingShowcaseVisible = stagingShowcaseCount === 3
      && stagingVisualState.workspaceVisible
      && stagingVisualState.rowCount === 3
      && stagingVisualState.reorderHandleCount === 3
      && stagingVisualState.imageCount === 2
      && stagingVisualState.textEditorCount === 1
      && stagingVisualState.scrolls
      && stagingVisualState.selectedTab;
    await captureWindow(path.join(qaDirectory, '06d-staging-workspace.png'));

    const contextMenuItems = await getStagingStore().list();
    const contextImage = contextMenuItems.find((item) => item.type === 'image');
    const contextText = await getStagingStore().createText('右键菜单删除测试');
    const contextTextCopy = await performStagingContextAction('copy', contextText.id);
    const contextTextSave = await performStagingContextAction('save', contextText.id);
    const contextImageCopy = await performStagingContextAction('copy', contextImage.id);
    const contextImageSave = await performStagingContextAction('save', contextImage.id);
    const contextTextDelete = await performStagingContextAction('delete', contextText.id);
    const stagingContextActionsWork = contextTextCopy.ok
      && contextTextCopy.type === 'text'
      && contextTextSave.ok
      && contextTextSave.saved
      && contextTextSave.type === 'text'
      && contextImageCopy.ok
      && contextImageCopy.type === 'image'
      && contextImageSave.ok
      && contextImageSave.saved
      && contextTextDelete.ok
      && contextTextDelete.action === 'delete'
      && contextTextDelete.items.length === 3;

    const rendererOpenedFloatingPreview = await mainWindow.webContents.executeJavaScript(
      'window.__desktopQa.openStagingPreview()',
    );
    await delay(320);
    if (!previewWindow || previewWindow.isDestroyed()) throw new Error('Floating preview window did not open.');
    const floatingPreviewBounds = previewWindow.getBounds();
    const floatingPreviewWorkArea = screen.getDisplayMatching(floatingPreviewBounds).workArea;
    const floatingPreviewState = await previewWindow.webContents.executeJavaScript(`
      (() => {
        const image = document.querySelector('#previewImage');
        const stage = document.querySelector('.preview-stage');
        const imageStyle = getComputedStyle(image);
        const stageRect = stage.getBoundingClientRect();
        const scale = Math.min(
          stageRect.width / Math.max(1, image.naturalWidth),
          stageRect.height / Math.max(1, image.naturalHeight),
        );
        return {
          loaded: document.body.classList.contains('is-loaded'),
          source: image.src,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: imageStyle.objectFit,
          containedWidth: image.naturalWidth * scale,
          containedHeight: image.naturalHeight * scale,
          stageWidth: stageRect.width,
          stageHeight: stageRect.height,
          title: document.querySelector('#previewTitle').textContent,
        };
      })()
    `);
    const floatingPreviewInsideWorkArea = floatingPreviewBounds.x >= floatingPreviewWorkArea.x
      && floatingPreviewBounds.y >= floatingPreviewWorkArea.y
      && floatingPreviewBounds.x + floatingPreviewBounds.width
        <= floatingPreviewWorkArea.x + floatingPreviewWorkArea.width
      && floatingPreviewBounds.y + floatingPreviewBounds.height
        <= floatingPreviewWorkArea.y + floatingPreviewWorkArea.height;
    const floatingPreviewVisible = rendererOpenedFloatingPreview
      && previewWindow.isVisible()
      && previewWindow.isAlwaysOnTop()
      && floatingPreviewBounds.width >= PREVIEW_MIN_WIDTH
      && floatingPreviewBounds.height > PREVIEW_MIN_HEIGHT
      && floatingPreviewInsideWorkArea
      && floatingPreviewState.loaded
      && floatingPreviewState.source.startsWith('staging-image://item/')
      && floatingPreviewState.naturalWidth === 278
      && floatingPreviewState.naturalHeight === 513
      && floatingPreviewState.objectFit === 'contain'
      && floatingPreviewState.containedWidth <= floatingPreviewState.stageWidth + 1
      && floatingPreviewState.containedHeight <= floatingPreviewState.stageHeight + 1
      && floatingPreviewState.title === '参考图.png';
    const stagingPreviewVisible = floatingPreviewVisible;
    await captureBrowserWindow(previewWindow, path.join(qaDirectory, '06e-floating-preview.png'));
    closeStagingPreviewWindow();
    await delay(100);

    await mainWindow.webContents.executeJavaScript("window.__desktopQa.openStagingShowcase('gray')");
    const hoverText = await getStagingStore().createText(Array.from(
      { length: 16 },
      (_, index) => `第 ${index + 1} 段：登录页交互说明，覆盖按钮状态、错误提示和跳转。`,
    ).join('\n'));
    const hoverShowResult = await showHoverPreviewWindow(hoverText.id);
    await delay(280);
    if (!hoverPreviewWindow || hoverPreviewWindow.isDestroyed()) throw new Error('Side hover preview window did not open.');
    const hoverPreviewBounds = hoverPreviewWindow.getBounds();
    const mainBoundsForHover = mainWindow.getBounds();
    const hoverPreviewState = await hoverPreviewWindow.webContents.executeJavaScript(`
      (() => ({
        mode: document.documentElement.dataset.mode,
        kind: document.body.dataset.kind,
        loaded: document.body.classList.contains('is-loaded'),
        text: document.querySelector('#previewText')?.textContent ?? '',
        headerDisplay: getComputedStyle(document.querySelector('.preview-header')).display,
        footerDisplay: getComputedStyle(document.querySelector('.preview-footer')).display,
      }))()
    `);
    const hoverTouchesLeft = Math.abs(
      (hoverPreviewBounds.x + hoverPreviewBounds.width + HOVER_PREVIEW_GAP) - mainBoundsForHover.x,
    ) <= 2;
    const hoverTouchesRight = Math.abs(
      (mainBoundsForHover.x + mainBoundsForHover.width + HOVER_PREVIEW_GAP) - hoverPreviewBounds.x,
    ) <= 2;
    const stagingHoverPreviewWorks = hoverShowResult?.ok
      && hoverShowResult.itemType === 'text'
      && (!previewWindow || previewWindow.isDestroyed())
      && hoverPreviewWindow.isVisible()
      && hoverPreviewBounds.height > PREVIEW_MIN_HEIGHT
      && (hoverTouchesLeft || hoverTouchesRight)
      && hoverPreviewState.mode === 'hover'
      && hoverPreviewState.kind === 'text'
      && hoverPreviewState.loaded
      && hoverPreviewState.text.includes('第 1 段')
      && hoverPreviewState.text.includes('第 16 段')
      && hoverPreviewState.headerDisplay === 'none'
      && hoverPreviewState.footerDisplay === 'none';
    await captureBrowserWindow(hoverPreviewWindow, path.join(qaDirectory, '06f-hover-preview.png'));
    closeHoverPreviewWindow();
    await getStagingStore().remove(hoverText.id);
    await delay(80);
    await mainWindow.webContents.executeJavaScript('window.__desktopQa.closePanels()');
    await mainWindow.webContents.executeJavaScript("window.__desktopQa.setThemeAndMeasure('graphite', 84)");

    const resizedState = setWindowSize({ width: 360, height: 240 });
    await delay(260);
    const resizedBounds = mainWindow.getBounds();
    const sizeAdjustmentWorks = resizedState.size.width === 360
      && resizedState.size.height === 240
      && Math.abs(resizedBounds.width - 360) <= 2
      && Math.abs(resizedBounds.height - 240) <= 2;
    setWindowSize(DEFAULT_SIZE);
    await delay(260);

    dockToEdge('right');
    await delay(240);
    const rightHandleBounds = getEdgeHandleBounds('right', normalBounds);
    const rightHandlePoint = {
      x: rightHandleBounds.x + Math.floor(rightHandleBounds.width / 2),
      y: rightHandleBounds.y + Math.floor(rightHandleBounds.height / 2),
    };
    const outsideHandlePoint = {
      x: rightHandleBounds.x - 48,
      y: rightHandleBounds.y - 24,
    };
    const rightHandleWorkArea = screen.getDisplayMatching(normalBounds).workArea;
    const hoverClock = Date.now() + 1000;
    processEdgeHoverPoint(outsideHandlePoint, hoverClock);
    const edgeHoverHitTargetWorks = edgeHoverArmed
      && rightHandleBounds.width === EDGE_REVEAL
      && rightHandleBounds.height === EDGE_HANDLE_LENGTH
      && rightHandleBounds.x + rightHandleBounds.width
        === rightHandleWorkArea.x + rightHandleWorkArea.width
      && pointIsInsideBounds(rightHandlePoint, rightHandleBounds);
    processEdgeHoverPoint(rightHandlePoint, hoverClock + 10);
    processEdgeHoverPoint(rightHandlePoint, hoverClock + 10 + EDGE_HOVER_OPEN_DELAY - 1);
    const hoverOpenDelayHonored = !isEdgePreviewed;
    processEdgeHoverPoint(rightHandlePoint, hoverClock + 10 + EDGE_HOVER_OPEN_DELAY + 1);
    await delay(280);
    const previewBounds = mainWindow.getBounds();
    const previewWorkArea = screen.getDisplayMatching(previewBounds).workArea;
    const previewVisibility = await mainWindow.webContents.executeJavaScript(`
      (() => ({
        panelOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
        handleDisplay: getComputedStyle(document.querySelector('#edgeHandle')).display,
        rendererEdge: document.querySelector('#app').dataset.edge,
        previewClass: document.querySelector('#app').classList.contains('is-edge-preview'),
      }))()
    `);
    const previewFullyInside = previewBounds.x >= previewWorkArea.x
      && previewBounds.y >= previewWorkArea.y
      && previewBounds.x + previewBounds.width <= previewWorkArea.x + previewWorkArea.width + 2
      && previewBounds.y + previewBounds.height <= previewWorkArea.y + previewWorkArea.height + 2;
    const previewOpened = dockedEdge === 'right'
      && isEdgePreviewed
      && previewFullyInside
      && previewVisibility.rendererEdge === 'right'
      && previewVisibility.previewClass
      && previewVisibility.panelOpacity === '1'
      && previewVisibility.handleDisplay === 'none';
    await captureWindow(path.join(qaDirectory, '07-edge-hover-preview.png'));
    const expandedInsidePoint = {
      x: previewBounds.x + Math.floor(previewBounds.width / 2),
      y: previewBounds.y + Math.floor(previewBounds.height / 2),
    };
    const expandedOutsidePoint = {
      x: previewBounds.x - 32,
      y: previewBounds.y - 32,
    };
    const leaveClock = hoverClock + 2000;
    processEdgeHoverPoint(expandedInsidePoint, leaveClock);
    processEdgeHoverPoint(expandedOutsidePoint, leaveClock + 10);
    processEdgeHoverPoint(expandedOutsidePoint, leaveClock + 10 + EDGE_HOVER_CLOSE_DELAY - 1);
    const hoverCloseDelayHonored = isEdgePreviewed;
    processEdgeHoverPoint(expandedOutsidePoint, leaveClock + 10 + EDGE_HOVER_CLOSE_DELAY + 1);
    await delay(280);
    const collapsedVisibility = await mainWindow.webContents.executeJavaScript(`
      (() => ({
        panelOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
        handleDisplay: getComputedStyle(document.querySelector('#edgeHandle')).display,
        previewClass: document.querySelector('#app').classList.contains('is-edge-preview'),
      }))()
    `);
    const edgeHoverRevealWorks = edgeHoverHitTargetWorks
      && hoverOpenDelayHonored
      && previewOpened
      && hoverCloseDelayHonored
      && dockedEdge === 'right'
      && !isEdgePreviewed
      && !collapsedVisibility.previewClass
      && collapsedVisibility.panelOpacity === '0'
      && collapsedVisibility.handleDisplay === 'grid'
      && boundsExposeEdge(mainWindow.getBounds(), 'right');
    restoreFromEdge({ focus: false });
    await delay(240);

    const repeatedEdgeCollapseChecks = [];
    dockToEdge('top');
    await delay(220);
    for (let cycle = 0; cycle < 6; cycle += 1) {
      previewFromEdge();
      await delay(180);
      const overlayAction = [
        "window.__desktopQa.openSettings('graphite')",
        "window.__desktopQa.openDirectTimePanel('graphite')",
        "window.__desktopQa.openStagingShowcase('graphite'); window.__desktopQa.openStagingPreview()",
      ][cycle % 3];
      await mainWindow.webContents.executeJavaScript(overlayAction);
      await delay(60);
      collapseEdgePreview();
      await delay(180);
      const cleanState = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const appRoot = document.querySelector('#app');
           const settings = document.querySelector('#settingsPanel');
           const schedule = document.querySelector('#schedulePanel');
           const dropOverlay = document.querySelector('#dropOverlay');
           const toast = document.querySelector('#toast');
          return {
            hiddenClass: appRoot.classList.contains('is-edge-hidden'),
            previewClass: appRoot.classList.contains('is-edge-preview'),
            shellOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
            handleDisplay: getComputedStyle(document.querySelector('#edgeHandle')).display,
            settingsHidden: settings.hidden,
             scheduleHidden: schedule.hidden,
             dropOverlayHidden: dropOverlay.hidden,
             settingsDisplay: getComputedStyle(settings).display,
             scheduleDisplay: getComputedStyle(schedule).display,
             dropOverlayDisplay: getComputedStyle(dropOverlay).display,
            toastVisible: toast.classList.contains('is-visible'),
          };
        })()
      `);
      repeatedEdgeCollapseChecks.push(
        dockedEdge === 'top'
        && !isEdgePreviewed
        && cleanState.hiddenClass
        && !cleanState.previewClass
        && cleanState.shellOpacity === '0'
        && cleanState.handleDisplay === 'grid'
        && cleanState.settingsHidden
         && cleanState.scheduleHidden
         && cleanState.dropOverlayHidden
         && cleanState.settingsDisplay === 'none'
         && cleanState.scheduleDisplay === 'none'
         && cleanState.dropOverlayDisplay === 'none'
        && !cleanState.toastVisible
        && (!previewWindow || previewWindow.isDestroyed())
        && (!hoverPreviewWindow || hoverPreviewWindow.isDestroyed())
        && boundsExposeEdge(mainWindow.getBounds(), 'top'),
      );
    }
    const repeatedEdgeCollapseClean = repeatedEdgeCollapseChecks.every(Boolean);
    await captureWindow(path.join(qaDirectory, '08-repeated-edge-clean.png'));
    restoreFromEdge({ focus: false });
    await delay(240);

    const undockByDragChecks = {};
    for (const [edgeIndex, edge] of [...VALID_EDGES].entries()) {
      dockToEdge(edge);
      await delay(240);
      previewFromEdge();
      await delay(260);

      const previewStartBounds = mainWindow.getBounds();
      const { workArea } = screen.getDisplayMatching(previewStartBounds);
      const targetBounds = {
        x: workArea.x + Math.round((workArea.width - currentSize.width) / 2) + (edgeIndex - 1) * 18,
        y: workArea.y + Math.round((workArea.height - currentSize.height) / 2) + (edgeIndex - 1) * 12,
        ...currentSize,
      };

      // Model the first native drag frame arriving while previewFromEdge's
      // managed-move guard is still alive. A changed target must be treated as
      // user ownership instead of being discarded as another setBounds event.
      isProgrammaticMove = true;
      programmaticMoveTarget = previewStartBounds;
      const undockedOnFirstMove = handleNativeWindowMove(targetBounds);
      setManagedBounds(targetBounds);
      await delay(260);
      handleManualMoveFinished({
        x: targetBounds.x + Math.round(targetBounds.width / 2),
        y: targetBounds.y + Math.round(targetBounds.height / 2),
      });
      await delay(220);

      const movedBounds = mainWindow.getBounds();
      const movedVisibility = await mainWindow.webContents.executeJavaScript(`
        (() => ({
          rendererEdge: document.querySelector('#app').dataset.edge,
          hiddenClass: document.querySelector('#app').classList.contains('is-edge-hidden'),
          previewClass: document.querySelector('#app').classList.contains('is-edge-preview'),
          panelOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
          handleDisplay: getComputedStyle(document.querySelector('#edgeHandle')).display,
        }))()
      `);
      undockByDragChecks[edge] = undockedOnFirstMove
        && dockedEdge === null
        && !isEdgePreviewed
        && boundsAreClose(movedBounds, targetBounds)
        && boundsAreClose(normalBounds, targetBounds)
        && movedVisibility.rendererEdge === ''
        && !movedVisibility.hiddenClass
        && !movedVisibility.previewClass
        && movedVisibility.panelOpacity === '1'
        && movedVisibility.handleDisplay === 'none';
      if (edge === 'right') await captureWindow(path.join(qaDirectory, '09-drag-undocked.png'));
    }
    const allEdgesUndockByDrag = Object.values(undockByDragChecks).every(Boolean);

    // Reproduce the real frameless drag failure: the title drag can carry more
    // than half the window beyond the right work-area edge while the pointer is
    // still pinned to that edge. This must take the same manual-release path as
    // a user drag, not call dockToEdge directly.
    const manualDisplay = screen.getDisplayMatching(normalBounds ?? mainWindow.getBounds());
    const manualRight = manualDisplay.workArea.x + manualDisplay.workArea.width;
    const overshotRightBounds = {
      x: manualRight - Math.round(DEFAULT_SIZE.width * 0.46),
      y: manualDisplay.workArea.y + Math.round((manualDisplay.workArea.height - DEFAULT_SIZE.height) / 2),
      ...DEFAULT_SIZE,
    };
    const rightEdgeCursor = {
      x: manualRight - 1,
      y: overshotRightBounds.y + 24,
    };
    const rightOvershootDetected = detectNearestEdge(overshotRightBounds, rightEdgeCursor) === 'right';
    dockedEdge = null;
    normalBounds = overshotRightBounds;
    setManagedBounds(overshotRightBounds);
    await delay(260);
    isProgrammaticMove = false;
    handleManualMoveFinished(rightEdgeCursor);
    await delay(280);
    const rightOvershootVisibility = await mainWindow.webContents.executeJavaScript(`
      (() => ({
        panelOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
        handleDisplay: getComputedStyle(document.querySelector('#edgeHandle')).display,
        rendererEdge: document.querySelector('#app').dataset.edge,
      }))()
    `);
    const rightOvershootHideWorks = rightOvershootDetected
      && dockedEdge === 'right'
      && rightOvershootVisibility.rendererEdge === 'right'
      && rightOvershootVisibility.panelOpacity === '0'
      && rightOvershootVisibility.handleDisplay === 'grid'
      && boundsExposeEdge(mainWindow.getBounds(), 'right');
    await captureWindow(path.join(qaDirectory, '08-right-overshoot-hidden.png'));
    restoreFromEdge({ focus: false });
    await delay(240);

    const edgeChecks = {};
    const edgeHandleShapeChecks = {};
    for (const [edgeIndex, edge] of [...VALID_EDGES].entries()) {
      dockToEdge(edge);
      await delay(260);
      const visibility = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const handle = getComputedStyle(document.querySelector('#edgeHandle'));
          return {
            panelOpacity: getComputedStyle(document.querySelector('.widget-shell')).opacity,
            handleDisplay: handle.display,
            rendererEdge: document.querySelector('#app').dataset.edge,
            handleStyle: {
              topLeftRadius: handle.borderTopLeftRadius,
              topRightRadius: handle.borderTopRightRadius,
              bottomRightRadius: handle.borderBottomRightRadius,
              bottomLeftRadius: handle.borderBottomLeftRadius,
              borderTopWidth: handle.borderTopWidth,
              borderRightWidth: handle.borderRightWidth,
              borderBottomWidth: handle.borderBottomWidth,
              borderLeftWidth: handle.borderLeftWidth,
            },
          };
        })()
      `);
      edgeHandleShapeChecks[edge] = edgeHandleFacesCenter(edge, visibility.handleStyle);
      edgeChecks[edge] = visibility.rendererEdge === edge
        && visibility.panelOpacity === '0'
        && visibility.handleDisplay === 'grid'
        && boundsExposeEdge(mainWindow.getBounds(), edge)
        && edgeHandleShapeChecks[edge];
      await captureWindow(path.join(
        qaDirectory,
        `${String(edgeIndex + 9).padStart(2, '0')}-edge-${edge}-hidden.png`,
      ));
      restoreFromEdge({ focus: false });
      await delay(220);
    }

    const qaResults = {
      ...functional,
      layoutsIdentical,
      stagingLayoutSignatures,
      stagingLayoutsIdentical,
      themesRendered: layoutSignatures.map((entry) => entry.theme),
      opacityApplied: layoutSignatures.every((entry) => entry.opacity === '0.84'),
      opacityRanges,
      opacityRangesUnified,
      sizeAdjustmentWorks,
      launchAtLoginSettingVisible,
      settingsBottomFocusState,
      settingsScrolledUpState,
      settingsReopenedState,
      settingsReverseScrollWorks,
      stagingVisualState,
      stagingShowcaseVisible,
      stagingContextActionsWork,
      floatingPreviewBounds,
      floatingPreviewState,
      floatingPreviewVisible,
      stagingPreviewVisible,
      hoverPreviewBounds,
      hoverPreviewState,
      stagingHoverPreviewWorks,
      edgeHoverHitTargetWorks,
      edgeHoverRevealWorks,
      repeatedEdgeCollapseChecks,
      repeatedEdgeCollapseClean,
      undockByDragChecks,
      allEdgesUndockByDrag,
      rightOvershootDetected,
      rightOvershootHideWorks,
      edgeChecks,
      edgeHandleShapeChecks,
      allEdgeHandlesFaceCenter: Object.values(edgeHandleShapeChecks).every(Boolean),
      allEdgesHide: Object.values(edgeChecks).every(Boolean),
      trayReady: Boolean(tray && !tray.isDestroyed()),
      shortcutRegistered,
    };
    const requiredChecks = [
      'headerDateWorks', 'headerDecorationRemoved', 'headerDragSpaceWorks', 'todoTerminologyWorks',
      'createdMany', 'scrollsWhenOverflowing', 'directlyEditable', 'typographyImproved',
      'fontSizeAdjustWorks',
      'singleLineCentered', 'emptyTodoDeletesImmediately', 'nonEmptyTodoRequiresConfirmation',
      'editorAutoHeightWorks', 'timeControlImproved', 'exactMinuteWorks',
      'directTimeInputWorks', 'dateOnlyWorks', 'emptyTimeWorks', 'reorderWorks', 'reorderPersisted',
      'v2MigrationWorks', 'launchAtLoginWorks', 'launchAtLoginSettingVisible', 'settingsReverseScrollWorks',
      'stagingWorkspaceWorks', 'stagingReorderWorks', 'stagingTextPersistenceWorks', 'stagingDeleteWorks',
      'stagingImageActionsWork', 'imageProtocolWorks', 'stagingPreviewWorks',
      'stagingHoverIconWorks', 'stagingTextPreviewWorks', 'stagingHoverPreviewWorks',
      'stagingShowcaseVisible', 'stagingContextActionsWork', 'floatingPreviewVisible', 'stagingPreviewVisible',
      'layoutsIdentical',
      'stagingLayoutsIdentical',
      'opacityApplied', 'opacityRangesUnified', 'sizeAdjustmentWorks',
      'edgeHoverHitTargetWorks', 'edgeHoverRevealWorks', 'repeatedEdgeCollapseClean', 'allEdgesUndockByDrag',
      'rightOvershootDetected', 'rightOvershootHideWorks',
      'allEdgeHandlesFaceCenter', 'allEdgesHide', 'trayReady',
    ];
    qaResults.passed = requiredChecks.every((check) => qaResults[check]);
    fs.writeFileSync(path.join(qaDirectory, 'qa-results.json'), JSON.stringify(qaResults, null, 2), 'utf8');
    if (!qaResults.passed) throw new Error('One or more V3 QA checks failed.');
  } catch (error) {
    try {
      fs.mkdirSync(qaDirectory, { recursive: true });
      fs.writeFileSync(path.join(qaDirectory, 'qa-error.txt'), String(error?.stack ?? error), 'utf8');
    } catch {}
    process.exitCode = 1;
  } finally {
    isQuitting = true;
    app.quit();
  }
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(() => {
    app.setName(APP_NAME);
    readWindowState();
    registerStagingProtocol();
    registerIpc();
    createWindow();
  });
  app.on('activate', () => showWindow());
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    isQuitting = true;
    closeAllPreviewWindows();
    clearInterval(edgeHoverMonitorTimer);
    clearTimeout(backgroundServicesTimer);
    clearTimeout(edgeSurfaceRefreshTimer);
    clearTimeout(edgePreviewShowTimer);
    writeWindowState();
    globalShortcut.unregisterAll();
  });
}
