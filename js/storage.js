/** 全部账本都在这把钥匙下面。没有账号，也没有服务器。 */
const KEY = 'jizhang.v1';

export function loadRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveRaw(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearRaw() {
  localStorage.removeItem(KEY);
}
