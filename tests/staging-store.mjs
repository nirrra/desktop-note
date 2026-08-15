import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createStagingStore,
  detectImageExtension,
  sanitizeDisplayName,
} = require('../src/staging-store.cjs');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/5G9ZkgAAAABJRU5ErkJggg==', 'base64');
const fakeImage = {
  isEmpty: () => false,
  getSize: () => ({ width: 64, height: 32 }),
  resize() { return this; },
  toPNG: () => png,
};
const fakeNativeImage = { createFromBuffer: () => fakeImage };

assert.equal(detectImageExtension(png), '.png');
assert.equal(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0x00])), '.jpg');
assert.equal(detectImageExtension(Buffer.from('GIF89a')), '.gif');
assert.equal(detectImageExtension(Buffer.from('BMxxxx')), '.bmp');
assert.equal(detectImageExtension(Buffer.from('RIFFxxxxWEBP')), '.webp');
assert.equal(detectImageExtension(Buffer.from('not an image')), null);
assert.equal(sanitizeDisplayName('..\\folder\\image.png'), 'image.png');

const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'desktop-note-staging-'));
let idCounter = 0;
const nextId = () => `test-item-${String(++idCounter).padStart(4, '0')}`;

try {
  const store = createStagingStore({
    baseDirectory: temporaryRoot,
    nativeImage: fakeNativeImage,
    now: () => 1_800_000_000_000 + idCounter,
    createId: nextId,
  });

  const text = await store.createText('暂存文字');
  const image = await store.importImageBuffer(png, { name: '截图.png' });
  assert.equal((await store.list()).length, 2);
  assert.equal((await store.list())[0].id, image.id);
  assert.equal((await store.getItem(image.id)).format, 'PNG');
  assert.ok(fs.existsSync(await store.getImagePath(image.id, 'original')));
  assert.ok(fs.existsSync(await store.getImagePath(image.id, 'thumbnail')));

  await store.updateText(text.id, '已编辑文字');
  await store.reorder([text.id, image.id]);
  assert.deepEqual((await store.list()).map((item) => item.id), [text.id, image.id]);

  const reloaded = createStagingStore({
    baseDirectory: temporaryRoot,
    nativeImage: fakeNativeImage,
    createId: nextId,
  });
  assert.deepEqual((await reloaded.list()).map((item) => item.id), [text.id, image.id]);
  assert.equal((await reloaded.getItem(text.id)).text, '已编辑文字');

  const originalPath = await reloaded.getImagePath(image.id, 'original');
  const thumbnailPath = await reloaded.getImagePath(image.id, 'thumbnail');
  await reloaded.remove(image.id);
  assert.equal(fs.existsSync(originalPath), false);
  assert.equal(fs.existsSync(thumbnailPath), false);

  const sourceFile = path.join(temporaryRoot, 'notes.pdf');
  await fs.promises.writeFile(sourceFile, 'dummy-pdf');
  const fileItem = await reloaded.importLocalFile(sourceFile);
  assert.equal(fileItem.type, 'file');
  assert.equal(fileItem.exists, true);
  assert.equal(fileItem.name, 'notes.pdf');
  await reloaded.remove(fileItem.id);
  assert.equal(fs.existsSync(sourceFile), true);
  assert.equal((await reloaded.list()).some((item) => item.id === fileItem.id), false);

  const leftover = path.join(temporaryRoot, 'originals', 'orphan.png');
  await fs.promises.writeFile(leftover, png);
  const imageAgain = await reloaded.importImageBuffer(png, { name: '再删.png' });
  await reloaded.remove(imageAgain.id);
  assert.equal(fs.existsSync(leftover), false);

  assert.equal(await reloaded.clear(), 1);
  assert.deepEqual(await reloaded.list(), []);
} finally {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  if (resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    await fs.promises.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}

console.log('Staging store checks passed: image detection, persistence, reorder, update, and cleanup work.');
