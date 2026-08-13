import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const require = createRequire(import.meta.url);
const { resolveLaunchAtLoginState } = require(path.join(root, 'src', 'login-item-state.cjs'));

const packageJson = JSON.parse(read('package.json'));
const main = read('main.js');
const preload = read('preload.js');
const html = read('src/index.html');
const css = read('src/styles.css');
const renderer = read('src/app.js');
const loginItemState = read('src/login-item-state.cjs');
const stagingStore = read('src/staging-store.cjs');
const previewHtml = read('src/preview.html');
const previewCss = read('src/preview.css');
const previewRenderer = read('src/preview.js');
const previewPreload = read('src/preview-preload.cjs');

assert.equal(packageJson.main, 'main.js');
assert.equal(packageJson.version, '0.3.17');
assert.equal(packageJson.build.productName, '桌面便签');
assert.ok(packageJson.build.win.target.some((target) => target.target === 'portable'));
assert.ok(packageJson.build.win.target.some((target) => target.target === 'zip'));
assert.match(packageJson.scripts.dist, /portable zip/);

for (const requiredFile of [
  'main.js', 'preload.js', 'src/index.html', 'src/styles.css', 'src/app.js', 'src/login-item-state.cjs',
  'src/staging-store.cjs', 'src/preview.html', 'src/preview.css', 'src/preview.js',
  'src/preview-preload.cjs', 'tests/staging-store.mjs',
]) {
  assert.ok(fs.existsSync(path.join(root, requiredFile)), `${requiredFile} should exist`);
}

assert.match(main, /DEFAULT_SIZE\s*=\s*\{\s*width:\s*330,\s*height:\s*230\s*\}/);
assert.match(main, /contextIsolation:\s*true/);
assert.match(main, /function guardGuiOutputStream/);
assert.match(main, /guardGuiOutputStream\(process\.stdout\)/);
assert.match(main, /guardGuiOutputStream\(process\.stderr\)/);
assert.doesNotMatch(main, /console\.log\(`QA_CAPTURE|console\.log\(`QA_RESULTS/);
assert.match(main, /qa-error\.txt/);
assert.match(main, /nodeIntegration:\s*false/);
assert.match(main, /sandbox:\s*true/);
assert.match(main, /globalShortcut\.register/);
assert.match(main, /new Tray/);
assert.match(main, /window:set-size/);
assert.match(main, /system:get-launch-at-login/);
assert.match(main, /system:set-launch-at-login/);
assert.match(main, /protocol\.registerSchemesAsPrivileged/);
assert.match(main, /protocol\.handle\(STAGING_SCHEME/);
assert.match(main, /staging:list/);
assert.match(main, /staging:paste/);
assert.match(main, /staging:pick-images/);
assert.match(main, /staging:save-image/);
assert.match(main, /staging:open-preview/);
assert.match(main, /staging:close-preview/);
assert.match(main, /staging:hover-preview/);
assert.match(main, /staging:hide-hover-preview/);
assert.match(main, /staging:keep-hover-preview/);
assert.match(main, /staging:context-menu/);
assert.match(main, /preview:get-data/);
assert.match(main, /preview:open-full/);
assert.match(main, /function getPreviewBounds/);
assert.match(main, /function getHoverPreviewBounds/);
assert.match(main, /function openStagingPreviewWindow/);
assert.match(main, /function showHoverPreviewWindow/);
assert.match(main, /function closeHoverPreviewWindow/);
assert.match(main, /function closeStagingPreviewWindow/);
assert.match(main, /function showStagingContextMenu/);
assert.match(main, /悬浮预览/);
assert.match(main, /复制图片/);
assert.match(main, /下载 \/ 另存图片/);
assert.match(main, /另存文字/);
assert.match(main, /删除暂存项/);
assert.match(main, /readClipboardFilePaths/);
assert.match(main, /clipboard\.readImage/);
assert.match(main, /dialog\.showOpenDialog/);
assert.match(main, /dialog\.showSaveDialog/);
assert.match(main, /app\.getLoginItemSettings/);
assert.match(main, /app\.setLoginItemSettings/);
assert.match(main, /process\.env\.PORTABLE_EXECUTABLE_FILE/);
assert.match(main, /resolveLaunchAtLoginState/);
assert.match(loginItemState, /findManagedLaunchItem/);
assert.match(loginItemState, /launchItem\.enabled !== false/);
assert.match(main, /if \(qaOutputDirectory\)[\s\S]*qaLaunchAtLoginEnabled/);
assert.match(main, /launchAtLoginSettingVisible/);
assert.match(main, /06b-settings-autostart\.png/);
assert.match(main, /settingsReverseScrollWorks/);
assert.match(main, /06c-settings-scroll-restored\.png/);
assert.match(main, /scrollIsAtOrigin\s*=\s*\(value\)\s*=>\s*Math\.abs\(value\)\s*<=\s*1/);
assert.match(main, /index\s*<\s*8[\s\S]*type:\s*'mouseWheel'[\s\S]*deltaY:\s*120/);
assert.match(main, /dockToEdge/);
assert.match(main, /restoreFromEdge/);
assert.doesNotMatch(preload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);

const loginTarget = { path: 'C:\\Apps\\桌面便签.exe', args: [] };
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: false,
  executableWillLaunchAtLogin: true,
  launchItems: [{ name: '桌面便签', path: 'c:\\apps\\桌面便签.exe', args: [], enabled: true }],
}, loginTarget, '桌面便签'), { enabled: true, registered: true });
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: true,
  executableWillLaunchAtLogin: false,
  launchItems: [{ name: '桌面便签', path: loginTarget.path, args: [], enabled: false }],
}, loginTarget, '桌面便签'), { enabled: false, registered: true });
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: false,
  executableWillLaunchAtLogin: true,
  launchItems: [{ name: '其他条目', path: loginTarget.path, args: [], enabled: true }],
}, loginTarget, '桌面便签'), { enabled: false, registered: false });
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: true,
  executableWillLaunchAtLogin: true,
}, loginTarget, '桌面便签'), { enabled: true, registered: false });
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: false,
  executableWillLaunchAtLogin: true,
  launchItems: [{ name: '桌面便签', path: loginTarget.path, args: ['--other'], enabled: true }],
}, loginTarget, '桌面便签'), { enabled: false, registered: false });
assert.deepEqual(resolveLaunchAtLoginState({
  openAtLogin: false,
  executableWillLaunchAtLogin: true,
  launchItems: [{ name: '桌面便签', path: loginTarget.path, args: ['C:\\My App'], enabled: true }],
}, { ...loginTarget, args: ['"C:\\My App"'] }, '桌面便签'), { enabled: true, registered: true });

for (const requiredId of [
  'addItem', 'itemsList', 'itemTemplate', 'settingsPanel', 'schedulePanel',
  'opacityInput', 'widthInput', 'heightInput', 'edgeHandle', 'hideButton',
  'launchAtLoginToggle', 'launchAtLoginHint',
  'itemsTab', 'stagingTab', 'stagingWorkspace', 'stagingList', 'stagingItemTemplate',
  'pasteStaging', 'clearStaging', 'dropOverlay',
]) {
  assert.match(html, new RegExp(`id="${requiredId}"`));
}

for (const theme of ['ivory', 'obsidian', 'smoke', 'classic']) {
  assert.match(html, new RegExp(`data-theme-choice="${theme}"`));
  assert.match(css, new RegExp(`data-theme="${theme}"`));
}

assert.match(html, /class="item-editor"/);
assert.match(html, /id="itemsTab"[\s\S]*?<span>待办<\/span>/);
assert.match(html, /id="itemsWorkspace"[^>]*aria-label="待办工作区"/);
assert.match(html, /id="addItem"[^>]*aria-label="新建待办"/);
assert.doesNotMatch(html, /drag-mark|事项/);
assert.doesNotMatch(css, /\.drag-mark/);
assert.match(html, /<time id="todayDate" datetime="2026-08-12">2026\/08\/12<\/time>/);
assert.doesNotMatch(html, /<strong>便签<\/strong>/);
assert.match(html, /class="schedule-button"/);
assert.match(html, /class="time-main"/);
assert.doesNotMatch(html, /class="schedule-icon"|class="time-sub"/);
assert.match(html, /class="delete-confirm"/);
assert.doesNotMatch(html, /<span class="time-main">—<\/span>/);
assert.doesNotMatch(html, /type="datetime-local"/);
assert.match(html, /id="datetimeDateInput"[^>]*type="date"/);
assert.match(html, /id="timeTextInput"[\s\S]*type="text"[\s\S]*inputmode="numeric"/);
assert.match(html, /type="date"/);
assert.doesNotMatch(html, /小芽|https?:\/\//, 'UI should be neutral and fully offline');
assert.match(html, /开机自启动/);
assert.match(html, /id="launchAtLoginToggle"[^>]*type="checkbox"[^>]*disabled/);
assert.match(html, /img-src 'self' data: staging-image:/);
assert.match(html, /class="reorder-handle staging-reorder"[^>]*draggable="true"/);
assert.match(html, /class="staging-thumbnail"/);
assert.match(html, /class="staging-text-editor"/);
assert.match(html, /Ctrl\+V 粘贴/);
assert.doesNotMatch(html, /imagePreviewPanel|imagePreview/);

assert.match(css, /--font:\s*"Microsoft YaHei UI"/);
assert.match(css, /--number-font:\s*"Segoe UI Variable Text"/);
assert.match(css, /\.drag-surface > time[\s\S]*font-size:\s*14px[\s\S]*font-variant-numeric:\s*tabular-nums/);
assert.match(css, /\.items-list[\s\S]*overflow-y:\s*auto/);
assert.match(css, /\.item-row[\s\S]*grid-template-columns:\s*20px minmax\(0,\s*1fr\) 58px 16px/);
assert.match(css, /\.item-editor[\s\S]*align-self:\s*center/);
assert.match(css, /\.item-editor[\s\S]*font-size:\s*12\.5px/);
assert.match(css, /\.schedule-button[\s\S]*width:\s*58px[\s\S]*border:\s*0[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
assert.match(css, /\.time-main[\s\S]*font-size:\s*12px/);
assert.match(css, /\.schedule-button:not\(\.has-time\)::after[\s\S]*content:\s*"设置时间"/);
assert.match(css, /\.datetime-inputs[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 78px/);
assert.match(css, /\.direct-time-input[\s\S]*font-variant-numeric:\s*tabular-nums/);
assert.match(css, /\.app\.is-edge-hidden \.widget-shell/);
assert.match(css, /\.app\.is-edge-hidden \.overlay-panel/);
assert.match(css, /\.app\.is-edge-hidden \.toast/);
assert.match(css, /\.app\.is-edge-preview \.widget-shell/);
assert.match(css, /\.edge-handle:hover/);
assert.match(css, /\.app\[data-edge="left"\] \.edge-handle\s*\{[^}]*border-left:\s*0;[^}]*border-radius:\s*0 9px 9px 0;/);
assert.match(css, /\.app\[data-edge="right"\] \.edge-handle\s*\{[^}]*border-right:\s*0;[^}]*border-radius:\s*9px 0 0 9px;/);
assert.match(css, /\.app\[data-edge="top"\] \.edge-handle\s*\{[^}]*border-top:\s*0;[^}]*border-radius:\s*0 0 9px 9px;/);
assert.match(css, /\.app\[data-edge="bottom"\] \.edge-handle\s*\{[^}]*border-bottom:\s*0;[^}]*border-radius:\s*9px 9px 0 0;/);
assert.match(css, /\.app\[data-theme="classic"\][\s\S]*--panel-rgb:\s*249,\s*247,\s*220/);
assert.match(css, /data-theme-choice="classic"[^\n]*#f9f7dc/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\.title-bar[\s\S]*grid-template-columns:\s*minmax\(88px,\s*1fr\) auto auto/);
assert.match(css, /\.title-bar[\s\S]*-webkit-app-region:\s*drag/);
assert.match(css, /\.drag-surface[\s\S]*min-width:\s*88px/);
assert.match(css, /\.workspace-tabs[\s\S]*-webkit-app-region:\s*no-drag/);
assert.match(css, /\.title-actions[\s\S]*-webkit-app-region:\s*no-drag/);
assert.match(css, /\.startup-row/);
assert.match(css, /\.toggle-row input:checked \+ \.switch i/);
assert.match(css, /\.overlay-panel\s*\{[\s\S]*overflow:\s*clip/);
assert.match(css, /\.settings-content\s*\{[\s\S]*overscroll-behavior-y:\s*contain/);
assert.match(css, /\.workspace-tab\.is-active::after[\s\S]*opacity:\s*1/);
assert.match(css, /\.staging-workspace[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\) 30px 22px/);
assert.match(css, /#itemsWorkspace[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\) 30px 20px/);
assert.match(css, /\.list-composer/);
assert.match(css, /\.staging-row[\s\S]*grid-template-columns:\s*18px 40px minmax\(0,\s*1fr\) 49px/);
assert.match(css, /\.staging-list[\s\S]*overflow-y:\s*auto/);
assert.doesNotMatch(css, /\.image-preview-panel/);
assert.match(css, /\.drop-overlay/);

assert.match(previewHtml, /id="previewImage"/);
assert.match(previewHtml, /id="previewText"/);
assert.match(previewHtml, /img-src staging-image:/);
assert.match(previewCss, /\.preview-stage img[\s\S]*object-fit:\s*contain/);
assert.match(previewCss, /html\[data-mode="hover"\] \.preview-header/);
assert.match(previewCss, /body\[data-kind="text"\] #previewText/);
assert.match(previewCss, /-webkit-app-region:\s*drag/);
assert.match(previewRenderer, /bridge\.getData\(\)/);
assert.match(previewRenderer, /bridge\.copy\(\)/);
assert.match(previewRenderer, /bridge\.save\(\)/);
assert.match(previewRenderer, /previewMode === 'hover'/);
assert.match(previewRenderer, /item\.type === 'text'/);
assert.match(previewPreload, /contextBridge\.exposeInMainWorld\('imagePreview'/);
assert.match(previewPreload, /preview:open-full/);
assert.match(previewPreload, /staging:keep-hover-preview/);
assert.doesNotMatch(previewPreload, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);

assert.match(renderer, /desktop-notes:v3/);
assert.match(renderer, /sprout-notes:v2/);
assert.match(renderer, /function createItem/);
assert.match(renderer, /function moveItem/);
assert.match(renderer, /function fitEditorHeight/);
assert.match(renderer, /function formatHeaderDate/);
assert.match(renderer, /function updateHeaderDate/);
assert.match(renderer, /setInterval\(updateHeaderDate,\s*60_000\)/);
assert.match(renderer, /headerDateWorks/);
assert.match(renderer, /headerDecorationRemoved/);
assert.match(renderer, /headerDragSpaceWorks/);
assert.match(renderer, /todoTerminologyWorks/);
assert.match(renderer, /emptyTodoDeletesImmediately/);
assert.match(renderer, /nonEmptyTodoRequiresConfirmation/);
assert.match(renderer, /measureOpacityRange/);
assert.match(main, /getDisplayNearestPoint/);
assert.match(main, /scheduleManualMoveFinished/);
assert.match(main, /function undockForManualMove/);
assert.match(main, /function handleNativeWindowMove/);
assert.match(main, /function startBackgroundServices/);
assert.match(main, /scheduleBackgroundServices\(\)/);
assert.match(main, /setTimeout\(startBackgroundServices,\s*120\)/);
assert.match(main, /mainWindow\.on\('move', \(\) => handleNativeWindowMove\(\)\)/);
assert.match(main, /if \(isProgrammaticMove && boundsAreClose\(bounds, programmaticMoveTarget\)\) return false/);
assert.match(main, /rightOvershootHideWorks/);
assert.match(main, /function previewFromEdge/);
assert.match(main, /function collapseEdgePreview/);
assert.match(main, /function getEdgeHandleBounds/);
assert.match(main, /function processEdgeHoverPoint/);
assert.match(main, /function startEdgeHoverMonitor/);
assert.match(main, /function refreshTransparentWindowSurface/);
assert.match(main, /function edgeHandleFacesCenter/);
assert.match(main, /EDGE_HOVER_OPEN_DELAY\s*=\s*120/);
assert.match(main, /EDGE_HOVER_CLOSE_DELAY\s*=\s*220/);
assert.match(main, /mainWindow\.hide\(\)[\s\S]*mainWindow\.showInactive\(\)[\s\S]*mainWindow\.moveTop\(\)/);
assert.match(main, /edgeHoverHitTargetWorks/);
assert.match(main, /edgeHoverRevealWorks/);
assert.match(main, /repeatedEdgeCollapseChecks/);
assert.match(main, /repeatedEdgeCollapseClean/);
assert.match(main, /undockByDragChecks/);
assert.match(main, /allEdgesUndockByDrag/);
assert.match(main, /allEdgeHandlesFaceCenter/);
assert.doesNotMatch(preload, /previewFromEdge|collapseEdgePreview/);
assert.match(renderer, /dragstart/);
assert.match(renderer, /addEventListener\('input'/);
assert.match(renderer, /mode:\s*'datetime'/);
assert.match(renderer, /mode:\s*'date'/);
assert.match(renderer, /padStart\(2,\s*'0'\)/);
assert.match(renderer, /invisibleTimeClickable/);
assert.match(renderer, /function normalizeDirectTime/);
assert.match(renderer, /directTimeInputWorks/);
assert.match(renderer, /function refreshLaunchAtLogin/);
assert.match(renderer, /function updateLaunchAtLogin/);
assert.match(renderer, /launchAtLoginWorks/);
assert.match(renderer, /function resetSettingsScroll/);
assert.match(renderer, /settingsPanel\.addEventListener\('scroll'/);
assert.equal((renderer.match(/error: result\.error \?\? null/g) ?? []).length, 2);
assert.match(preload, /getLaunchAtLogin:[\s\S]*system:get-launch-at-login/);
assert.match(preload, /setLaunchAtLogin:[\s\S]*system:set-launch-at-login/);
assert.match(preload, /listStaging:[\s\S]*staging:list/);
assert.match(preload, /importStagingFiles:[\s\S]*staging:import-files/);
assert.match(preload, /pasteToStaging:[\s\S]*staging:paste/);
assert.match(preload, /openStagingPreview:[\s\S]*staging:open-preview/);
assert.match(preload, /closeStagingPreview:[\s\S]*staging:close-preview/);
assert.match(preload, /showStagingHover:[\s\S]*staging:hover-preview/);
assert.match(preload, /hideStagingHover:[\s\S]*staging:hide-hover-preview/);
assert.match(preload, /showStagingContextMenu:[\s\S]*staging:context-menu/);
assert.match(renderer, /function renderStagingItems/);
assert.match(renderer, /function moveStagingItem/);
assert.match(renderer, /function importStagingFileObjects/);
assert.match(renderer, /function targetAcceptsTextInput/);
assert.match(renderer, /document\.addEventListener\('paste'/);
assert.match(renderer, /document\.addEventListener\('drop'/);
assert.match(renderer, /row\.addEventListener\('contextmenu'/);
assert.match(renderer, /stagingWorkspaceWorks/);
assert.match(renderer, /stagingPreviewWorks/);
assert.match(renderer, /stagingHoverIconWorks/);
assert.match(renderer, /stagingTextPreviewWorks/);
assert.match(renderer, /pointerenter/);
assert.match(renderer, /showStagingHover/);
assert.match(renderer, /function openStagingItemPreview/);
assert.match(renderer, /measureStagingLayout/);
assert.match(main, /stagingShowcaseVisible/);
assert.match(main, /stagingLayoutsIdentical/);
assert.match(main, /stagingContextActionsWork/);
assert.match(main, /floatingPreviewVisible/);
assert.match(main, /stagingHoverPreviewWorks/);
assert.match(main, /06f-hover-preview\.png/);
assert.match(main, /previewWindow\.isAlwaysOnTop\(\)/);
assert.match(main, /closeAllPreviewWindows\(\)[\s\S]*mainWindow\.hide\(\)/);
assert.match(main, /06d-staging-workspace\.png/);
assert.match(main, /06e-floating-preview\.png/);
assert.match(stagingStore, /MAX_STAGING_IMAGE_BYTES\s*=\s*30 \* 1024 \* 1024/);
assert.match(stagingStore, /function detectImageExtension/);
assert.match(stagingStore, /function createStagingStore/);
assert.match(stagingStore, /async function reorder/);
assert.doesNotMatch(renderer, /edgeHoverActive|edgeHandle\.addEventListener\('mouseenter'|app\.addEventListener\('mouseleave'/);
assert.match(renderer, /if \(hiddenAtEdge\)[\s\S]*closePanels\(\)[\s\S]*toast\.classList\.remove\('is-visible'\)/);
assert.match(css, /\.app\.is-edge-hidden \.widget-shell[\s\S]*visibility:\s*hidden/);
assert.match(css, /\.app\.is-edge-preview \.widget-shell[\s\S]*visibility:\s*visible/);
assert.doesNotMatch(renderer, /\.innerHTML\s*=/, 'Renderer should not inject HTML strings');

console.log('V3 smoke checks passed: todos, sortable staging, side hover preview, floating preview, context actions, four skins, sizing, and edge hiding are present.');
