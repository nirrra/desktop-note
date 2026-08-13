const path = require('node:path');

function normalizePath(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return path.resolve(value).toLocaleLowerCase();
}

function normalizeArgument(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).toLocaleLowerCase();
  }
  return text.toLocaleLowerCase();
}

function argumentsMatch(actual, expected) {
  const left = Array.isArray(actual) ? actual.map(normalizeArgument) : [];
  const right = Array.isArray(expected) ? expected.map(normalizeArgument) : [];
  return left.length === right.length && left.every((argument, index) => argument === right[index]);
}

function findManagedLaunchItem(settings, target, entryName) {
  const expectedPath = normalizePath(target?.path);
  const expectedName = String(entryName ?? '').toLocaleLowerCase();
  return (Array.isArray(settings?.launchItems) ? settings.launchItems : []).find((item) => (
    String(item?.name ?? '').toLocaleLowerCase() === expectedName
    && normalizePath(item?.path) === expectedPath
    && argumentsMatch(item?.args, target?.args)
  )) ?? null;
}

function resolveLaunchAtLoginState(settings, target, entryName) {
  const launchItem = findManagedLaunchItem(settings, target, entryName);
  if (launchItem) {
    return {
      enabled: launchItem.enabled !== false,
      registered: true,
    };
  }

  // Compatibility fallback for Electron versions that do not expose
  // launchItems. Both legacy booleans are required so a disabled Run item is
  // not shown as active.
  return {
    enabled: Boolean(settings?.openAtLogin && settings?.executableWillLaunchAtLogin),
    registered: false,
  };
}

module.exports = {
  argumentsMatch,
  findManagedLaunchItem,
  resolveLaunchAtLoginState,
};
