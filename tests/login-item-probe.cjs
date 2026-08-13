const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { resolveLaunchAtLoginState } = require('../src/login-item-state.cjs');

const outputPath = path.resolve(process.env.DESKTOP_NOTE_LOGIN_PROBE_OUTPUT ?? 'qa-output/login-item-probe.json');
const executablePath = path.resolve(process.env.DESKTOP_NOTE_LOGIN_PROBE_TARGET ?? process.execPath);
const entryName = `桌面便签-QA-${process.pid}`;
const query = { path: executablePath, args: [] };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function snapshot(label) {
  const settings = app.getLoginItemSettings(query);
  return {
    label,
    openAtLogin: settings.openAtLogin,
    executableWillLaunchAtLogin: settings.executableWillLaunchAtLogin,
    resolved: resolveLaunchAtLoginState(settings, query, entryName),
    matchingItems: settings.launchItems.filter((item) => (
      item.path.toLocaleLowerCase() === executablePath.toLocaleLowerCase()
    )),
  };
}

app.whenReady().then(async () => {
  const result = { executablePath, entryName, snapshots: [] };
  try {
    result.snapshots.push(snapshot('before'));
    app.setLoginItemSettings({
      openAtLogin: true,
      path: executablePath,
      args: [],
      name: entryName,
      enabled: true,
    });
    result.snapshots.push(snapshot('immediate'));
    await delay(250);
    result.snapshots.push(snapshot('after-250ms'));
    app.setLoginItemSettings({
      openAtLogin: true,
      path: executablePath,
      args: [],
      name: entryName,
      enabled: false,
    });
    result.snapshots.push(snapshot('after-disable'));
    app.setLoginItemSettings({
      openAtLogin: true,
      path: executablePath,
      args: [],
      name: entryName,
      enabled: true,
    });
    result.snapshots.push(snapshot('after-reenable'));
  } catch (error) {
    result.error = String(error?.stack ?? error);
  } finally {
    try {
      app.setLoginItemSettings({
        openAtLogin: false,
        path: executablePath,
        args: [],
        name: entryName,
      });
      result.snapshots.push(snapshot('after-remove'));
    } catch (error) {
      result.cleanupError = String(error?.stack ?? error);
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    app.quit();
  }
});
