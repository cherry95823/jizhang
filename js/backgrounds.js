/**
 * 壁纸偏好存在 localStorage（很小）。
 * 自己上传的照片放 IndexedDB，避免把大图塞进 localStorage 把账本挤掉。
 */

const PREF_KEY = 'jizhang.bg.v1';
const DB_NAME = 'jizhang-bg';
const STORE = 'uploads';

export const BG_EXPORT_LIMIT = 900_000;
export const DEFAULT_VEIL = 0.38;

export function normalizeBgPref(raw) {
  const kind = raw?.kind === 'sakura' || raw?.kind === 'upload' ? raw.kind : 'rose';
  const veil = Number(raw?.veil);
  return {
    kind,
    uploadId: kind === 'upload' && raw?.uploadId ? String(raw.uploadId) : null,
    veil: Number.isFinite(veil) ? Math.min(1, Math.max(0, veil)) : DEFAULT_VEIL,
  };
}

/** 没有照片，或照片合计超过限额时，备份里不带图片。 */
export function backgroundsFitExport(totalBytes) {
  return totalBytes > 0 && totalBytes <= BG_EXPORT_LIMIT;
}

export function loadBgPref() {
  try {
    return normalizeBgPref(JSON.parse(localStorage.getItem(PREF_KEY) || 'null'));
  } catch {
    return normalizeBgPref(null);
  }
}

export function saveBgPref(pref) {
  const next = normalizeBgPref(pref);
  localStorage.setItem(PREF_KEY, JSON.stringify(next));
  return next;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function listUploads() {
  const database = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addUpload(record) {
  const database = await openDb();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put(record);
  await txDone(transaction);
}

export async function removeUpload(id) {
  const database = await openDb();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).delete(id);
  await txDone(transaction);
}

function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadImageElement(file));
  }
  return loadImageElement(file);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('这张图打不开'));
    };
    image.src = url;
  });
}

/** 长边压到 1440 像素以内，存成 JPEG，避免手机相册原图把存储撑满。 */
export async function fileToWallpaper(file) {
  const image = await loadImage(file);
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('这张图打不开');
  const scale = Math.min(1, 1440 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#f6e3e2';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  if (typeof image.close === 'function') image.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('这张图没法压缩');
  return { blob, width, height };
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}
