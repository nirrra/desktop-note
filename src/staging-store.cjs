const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const STAGING_INDEX_VERSION = 1;
const MAX_STAGING_ITEMS = 200;
const MAX_STAGING_TEXT_LENGTH = 5000;
const MAX_STAGING_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_FILE_PATH_LENGTH = 4096;

const IMAGE_FORMATS = {
  '.png': { mimeType: 'image/png', format: 'PNG' },
  '.jpg': { mimeType: 'image/jpeg', format: 'JPEG' },
  '.gif': { mimeType: 'image/gif', format: 'GIF' },
  '.webp': { mimeType: 'image/webp', format: 'WEBP' },
  '.bmp': { mimeType: 'image/bmp', format: 'BMP' },
};

function createStoreError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sanitizeDisplayName(value, fallback = '暂存图片') {
  const baseName = path.basename(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim());
  return (baseName || fallback).slice(0, MAX_DISPLAY_NAME_LENGTH);
}

function isSafeStorageName(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 180
    && path.basename(value) === value
    && /^[a-zA-Z0-9._-]+$/.test(value);
}

function detectImageExtension(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return '.png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return '.gif';
  if (buffer.length >= 2 && buffer.subarray(0, 2).toString('ascii') === 'BM') return '.bmp';
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return '.webp';
  return null;
}

function normalizeSuggestedName(displayName, extension) {
  const parsed = path.parse(sanitizeDisplayName(displayName));
  const stem = (parsed.name || '暂存图片').slice(0, MAX_DISPLAY_NAME_LENGTH - extension.length);
  return `${stem}${extension}`;
}

function normalizeFilePath(value) {
  const resolved = path.resolve(String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim());
  if (!path.isAbsolute(resolved) || resolved.length > MAX_FILE_PATH_LENGTH) return '';
  return resolved;
}

function normalizeStoredItem(raw, index = 0) {
  if (!raw || !['text', 'image', 'file'].includes(raw.type)) return null;
  const id = String(raw.id ?? '').trim();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return null;
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now() - index;
  const common = {
    id,
    type: raw.type,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
  };

  if (raw.type === 'text') {
    if (typeof raw.text !== 'string') return null;
    return { ...common, text: raw.text.slice(0, MAX_STAGING_TEXT_LENGTH) };
  }

  if (raw.type === 'file') {
    const filePath = normalizeFilePath(raw.filePath);
    if (!filePath) return null;
    const extension = path.extname(filePath).toLowerCase().slice(0, 16);
    return {
      ...common,
      name: sanitizeDisplayName(raw.name ?? path.basename(filePath), '暂存文件'),
      filePath,
      extension,
      bytes: Math.max(0, Math.round(Number(raw.bytes) || 0)),
    };
  }

  if (!isSafeStorageName(raw.fileName) || !isSafeStorageName(raw.thumbnailName)) return null;
  const extension = Object.hasOwn(IMAGE_FORMATS, raw.extension) ? raw.extension : null;
  if (!extension) return null;
  return {
    ...common,
    name: sanitizeDisplayName(raw.name),
    suggestedName: normalizeSuggestedName(raw.suggestedName ?? raw.name, extension),
    extension,
    mimeType: IMAGE_FORMATS[extension].mimeType,
    format: IMAGE_FORMATS[extension].format,
    width: Math.max(1, Math.round(Number(raw.width) || 1)),
    height: Math.max(1, Math.round(Number(raw.height) || 1)),
    bytes: Math.max(0, Math.round(Number(raw.bytes) || 0)),
    fileName: raw.fileName,
    thumbnailName: raw.thumbnailName,
  };
}

function inspectFilePath(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { exists: false, bytes: 0 };
    return { exists: true, bytes: stat.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

function toPublicItem(item) {
  if (item.type === 'text') return { ...item };
  if (item.type === 'file') {
    const live = inspectFilePath(item.filePath);
    return {
      ...item,
      bytes: live.exists ? live.bytes : item.bytes,
      exists: live.exists,
    };
  }
  const { fileName: _fileName, thumbnailName: _thumbnailName, extension: _extension, ...publicItem } = item;
  return publicItem;
}

function fitThumbnailSize(width, height) {
  const scale = Math.min(1, 240 / width, 160 / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createStagingStore({ baseDirectory, nativeImage, now = () => Date.now(), createId = () => crypto.randomUUID() }) {
  if (!baseDirectory || !path.isAbsolute(baseDirectory)) throw new TypeError('baseDirectory must be absolute');
  if (!nativeImage?.createFromBuffer) throw new TypeError('nativeImage is required');

  const indexFile = path.join(baseDirectory, 'index.json');
  const originalsDirectory = path.join(baseDirectory, 'originals');
  const thumbnailsDirectory = path.join(baseDirectory, 'thumbnails');
  let items = null;
  let loadingPromise = null;
  let mutationQueue = Promise.resolve();

  async function ensureDirectories() {
    await Promise.all([
      fs.promises.mkdir(originalsDirectory, { recursive: true }),
      fs.promises.mkdir(thumbnailsDirectory, { recursive: true }),
    ]);
  }

  async function regenerateThumbnail(item, originalPath, thumbnailPath) {
    try {
      const buffer = await fs.promises.readFile(originalPath);
      const image = nativeImage.createFromBuffer(buffer);
      if (image.isEmpty()) return false;
      const size = image.getSize();
      const thumbnail = image.resize({ ...fitThumbnailSize(size.width, size.height), quality: 'good' });
      await fs.promises.writeFile(thumbnailPath, thumbnail.toPNG());
      return true;
    } catch {
      return false;
    }
  }

  async function load() {
    if (items) return items;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      await ensureDirectories();
      let rawItems = [];
      try {
        const saved = JSON.parse(await fs.promises.readFile(indexFile, 'utf8'));
        rawItems = Array.isArray(saved?.items) ? saved.items : [];
      } catch {}

      const restored = [];
      for (const [index, raw] of rawItems.entries()) {
        const item = normalizeStoredItem(raw, index);
        if (!item) continue;
        if (item.type === 'image') {
          const originalPath = path.join(originalsDirectory, item.fileName);
          const thumbnailPath = path.join(thumbnailsDirectory, item.thumbnailName);
          try {
            await fs.promises.access(originalPath, fs.constants.R_OK);
          } catch {
            continue;
          }
          try {
            await fs.promises.access(thumbnailPath, fs.constants.R_OK);
          } catch {
            await regenerateThumbnail(item, originalPath, thumbnailPath);
          }
        }
        restored.push(item);
        if (restored.length >= MAX_STAGING_ITEMS) break;
      }
      items = restored;
      return items;
    })();
    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  async function persist() {
    await ensureDirectories();
    const temporaryFile = `${indexFile}.${process.pid}.${Date.now()}.tmp`;
    const document = JSON.stringify({ version: STAGING_INDEX_VERSION, items }, null, 2);
    try {
      await fs.promises.writeFile(temporaryFile, document, 'utf8');
      await fs.promises.copyFile(temporaryFile, indexFile);
    } finally {
      await fs.promises.unlink(temporaryFile).catch(() => {});
    }
  }

  function mutate(operation) {
    const pending = mutationQueue.then(async () => {
      await load();
      return operation();
    });
    mutationQueue = pending.catch(() => {});
    return pending;
  }

  async function sweepOrphanedImages() {
    const usedOriginals = new Set(items.filter((item) => item.type === 'image').map((item) => item.fileName));
    const usedThumbnails = new Set(items.filter((item) => item.type === 'image').map((item) => item.thumbnailName));
    await Promise.all([
      removeUnusedFiles(originalsDirectory, usedOriginals),
      removeUnusedFiles(thumbnailsDirectory, usedThumbnails),
    ]);
  }

  async function removeUnusedFiles(directory, usedNames) {
    let names = [];
    try {
      names = await fs.promises.readdir(directory);
    } catch {
      return;
    }
    await Promise.all(names.map((name) => (
      usedNames.has(name) ? Promise.resolve() : fs.promises.unlink(path.join(directory, name)).catch(() => {})
    )));
  }

  async function removeStoredImageFiles(item) {
    if (item?.type !== 'image') return;
    await Promise.all([
      fs.promises.unlink(path.join(originalsDirectory, item.fileName)).catch(() => {}),
      fs.promises.unlink(path.join(thumbnailsDirectory, item.thumbnailName)).catch(() => {}),
    ]);
  }

  async function list() {
    await load();
    return items.map(toPublicItem);
  }

  async function createText(text = '') {
    return mutate(async () => {
      if (items.length >= MAX_STAGING_ITEMS) throw createStoreError('LIMIT_ITEMS', `暂存区最多保存 ${MAX_STAGING_ITEMS} 项`);
      const timestamp = now();
      const item = {
        id: createId(),
        type: 'text',
        text: String(text).slice(0, MAX_STAGING_TEXT_LENGTH),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      items.unshift(item);
      await persist();
      return toPublicItem(item);
    });
  }

  async function importImageBuffer(input, { name = '暂存图片' } = {}) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input ?? []);
    if (buffer.length === 0) throw createStoreError('EMPTY_IMAGE', '图片内容为空');
    if (buffer.length > MAX_STAGING_IMAGE_BYTES) throw createStoreError('LIMIT_IMAGE_SIZE', '单张图片不能超过 30 MB');
    const extension = detectImageExtension(buffer);
    if (!extension) throw createStoreError('UNSUPPORTED_IMAGE', '仅支持 PNG、JPG、WebP、GIF 和 BMP 图片');

    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) throw createStoreError('INVALID_IMAGE', '无法读取该图片');
    const size = image.getSize();
    if (!size.width || !size.height) throw createStoreError('INVALID_IMAGE_SIZE', '图片尺寸无效');
    const thumbnail = image.resize({ ...fitThumbnailSize(size.width, size.height), quality: 'good' }).toPNG();

    return mutate(async () => {
      if (items.length >= MAX_STAGING_ITEMS) throw createStoreError('LIMIT_ITEMS', `暂存区最多保存 ${MAX_STAGING_ITEMS} 项`);
      const id = createId();
      const timestamp = now();
      const fileName = `${id}${extension}`;
      const thumbnailName = `${id}.png`;
      const originalPath = path.join(originalsDirectory, fileName);
      const thumbnailPath = path.join(thumbnailsDirectory, thumbnailName);
      await ensureDirectories();
      try {
        await fs.promises.writeFile(originalPath, buffer);
        await fs.promises.writeFile(thumbnailPath, thumbnail);
        const item = {
          id,
          type: 'image',
          name: sanitizeDisplayName(name),
          suggestedName: normalizeSuggestedName(name, extension),
          extension,
          mimeType: IMAGE_FORMATS[extension].mimeType,
          format: IMAGE_FORMATS[extension].format,
          width: size.width,
          height: size.height,
          bytes: buffer.length,
          fileName,
          thumbnailName,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        items.unshift(item);
        await persist();
        return toPublicItem(item);
      } catch (error) {
        await Promise.all([
          fs.promises.unlink(originalPath).catch(() => {}),
          fs.promises.unlink(thumbnailPath).catch(() => {}),
        ]);
        throw error;
      }
    });
  }

  async function importImageFile(filePath) {
    const resolvedPath = path.resolve(String(filePath ?? ''));
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) throw createStoreError('NOT_A_FILE', '选择的内容不是文件');
    if (stat.size > MAX_STAGING_IMAGE_BYTES) throw createStoreError('LIMIT_IMAGE_SIZE', '单张图片不能超过 30 MB');
    return importImageBuffer(await fs.promises.readFile(resolvedPath), { name: path.basename(resolvedPath) });
  }

  async function createFileBookmark(filePath) {
    const resolvedPath = normalizeFilePath(filePath);
    if (!resolvedPath) throw createStoreError('INVALID_PATH', '文件路径无效');
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) throw createStoreError('NOT_A_FILE', '选择的内容不是文件');
    return mutate(async () => {
      if (items.length >= MAX_STAGING_ITEMS) throw createStoreError('LIMIT_ITEMS', `暂存区最多保存 ${MAX_STAGING_ITEMS} 项`);
      const timestamp = now();
      const item = {
        id: createId(),
        type: 'file',
        name: sanitizeDisplayName(path.basename(resolvedPath), '暂存文件'),
        filePath: resolvedPath,
        extension: path.extname(resolvedPath).toLowerCase().slice(0, 16),
        bytes: stat.size,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      items.unshift(item);
      await persist();
      return toPublicItem(item);
    });
  }

  async function importLocalFile(filePath) {
    const resolvedPath = normalizeFilePath(filePath);
    if (!resolvedPath) throw createStoreError('INVALID_PATH', '文件路径无效');
    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isFile()) throw createStoreError('NOT_A_FILE', '选择的内容不是文件');
    if (stat.size <= MAX_STAGING_IMAGE_BYTES) {
      const handle = await fs.promises.open(resolvedPath, 'r');
      try {
        const header = Buffer.alloc(16);
        await handle.read(header, 0, 16, 0);
        if (detectImageExtension(header)) {
          return importImageFile(resolvedPath);
        }
      } finally {
        await handle.close();
      }
    }
    return createFileBookmark(resolvedPath);
  }

  async function updateText(id, text) {
    return mutate(async () => {
      const item = items.find((candidate) => candidate.id === id && candidate.type === 'text');
      if (!item) throw createStoreError('ITEM_NOT_FOUND', '暂存文字不存在');
      item.text = String(text).slice(0, MAX_STAGING_TEXT_LENGTH);
      item.updatedAt = now();
      await persist();
      return toPublicItem(item);
    });
  }

  async function reorder(orderedIds) {
    return mutate(async () => {
      const uniqueIds = [...new Set(Array.isArray(orderedIds) ? orderedIds.map(String) : [])];
      const byId = new Map(items.map((item) => [item.id, item]));
      const reordered = uniqueIds.map((id) => byId.get(id)).filter(Boolean);
      for (const item of items) if (!uniqueIds.includes(item.id)) reordered.push(item);
      items = reordered;
      await persist();
      return items.map(toPublicItem);
    });
  }

  async function remove(id) {
    return mutate(async () => {
      const index = items.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw createStoreError('ITEM_NOT_FOUND', '暂存项不存在');
      const [item] = items.splice(index, 1);
      await removeStoredImageFiles(item);
      await persist();
      await sweepOrphanedImages();
      return toPublicItem(item);
    });
  }

  async function clear() {
    return mutate(async () => {
      const removed = items;
      items = [];
      await Promise.all(removed.map((item) => removeStoredImageFiles(item)));
      await persist();
      await sweepOrphanedImages();
      return removed.length;
    });
  }

  async function getItem(id) {
    await load();
    const item = items.find((candidate) => candidate.id === id);
    return item ? toPublicItem(item) : null;
  }

  async function getImagePath(id, kind = 'original') {
    await load();
    const item = items.find((candidate) => candidate.id === id && candidate.type === 'image');
    if (!item) return null;
    return kind === 'thumbnail'
      ? path.join(thumbnailsDirectory, item.thumbnailName)
      : path.join(originalsDirectory, item.fileName);
  }

  return {
    list,
    createText,
    importImageBuffer,
    importImageFile,
    importLocalFile,
    createFileBookmark,
    updateText,
    reorder,
    remove,
    clear,
    getItem,
    getImagePath,
    limits: {
      maxItems: MAX_STAGING_ITEMS,
      maxTextLength: MAX_STAGING_TEXT_LENGTH,
      maxImageBytes: MAX_STAGING_IMAGE_BYTES,
    },
  };
}

module.exports = {
  IMAGE_FORMATS,
  MAX_STAGING_IMAGE_BYTES,
  MAX_STAGING_ITEMS,
  MAX_STAGING_TEXT_LENGTH,
  createStagingStore,
  detectImageExtension,
  normalizeFilePath,
  sanitizeDisplayName,
};
