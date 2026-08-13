const bridge = window.imagePreview;
const previewMode = new URLSearchParams(location.search).get('mode') === 'hover' ? 'hover' : 'window';
document.documentElement.dataset.mode = previewMode;

const elements = {
  title: document.querySelector('#previewTitle'),
  image: document.querySelector('#previewImage'),
  text: document.querySelector('#previewText'),
  meta: document.querySelector('#previewMeta'),
  status: document.querySelector('#previewStatus'),
  close: document.querySelector('#closePreview'),
  copy: document.querySelector('#copyPreview'),
  save: document.querySelector('#savePreview'),
};

let statusTimer = null;

function showStatus(message) {
  clearTimeout(statusTimer);
  elements.status.textContent = message;
  statusTimer = setTimeout(() => { elements.status.textContent = ''; }, 1600);
}

function setBusy(busy) {
  elements.copy.disabled = busy;
  elements.save.disabled = busy;
}

function renderItem(item) {
  document.body.dataset.kind = item.type;
  document.body.classList.remove('is-loaded');
  elements.image.removeAttribute('src');
  elements.text.textContent = '';

  if (item.type === 'text') {
    document.title = '文字预览';
    elements.title.textContent = '暂存文字';
    elements.meta.textContent = `${Array.from(item.text ?? '').length} 字`;
    elements.text.textContent = item.text ?? '';
    elements.save.textContent = '另存文字';
    document.body.classList.add('is-loaded');
    return;
  }

  document.title = `图片预览 · ${item.name}`;
  elements.title.textContent = item.name;
  elements.meta.textContent = `${item.width} × ${item.height} · ${item.format}`;
  elements.save.textContent = '下载 / 另存';
  elements.image.alt = `完整预览：${item.name}`;
  elements.image.addEventListener('load', () => document.body.classList.add('is-loaded'), { once: true });
  elements.image.addEventListener('error', () => showStatus('图片加载失败'), { once: true });
  elements.image.src = item.originalUrl;
}

async function loadPreview() {
  const result = await bridge.getData();
  if (!result?.ok || !['image', 'text'].includes(result.item?.type)) {
    showStatus(result?.error ?? '预览内容不存在');
    setBusy(true);
    return;
  }
  setBusy(false);
  renderItem(result.item);
}

async function copyContent() {
  setBusy(true);
  const result = await bridge.copy();
  setBusy(false);
  showStatus(result?.ok ? '已复制' : (result?.error ?? '复制失败'));
}

async function saveContent() {
  setBusy(true);
  const result = await bridge.save();
  setBusy(false);
  if (!result?.canceled) showStatus(result?.ok ? '已保存' : (result?.error ?? '保存失败'));
}

elements.close.addEventListener('click', () => bridge.close());
elements.copy.addEventListener('click', () => void copyContent());
elements.save.addEventListener('click', () => void saveContent());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') bridge.close();
  if (previewMode === 'hover') return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    void copyContent();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveContent();
  }
});

if (previewMode === 'hover') {
  document.addEventListener('pointerenter', () => void bridge.keepHover());
  document.addEventListener('click', () => void bridge.openFull());
}

bridge.onRefresh(() => void loadPreview());
void loadPreview();
