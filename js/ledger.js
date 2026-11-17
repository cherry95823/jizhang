/**
 * 记账本的纯计算层。
 * 不碰 DOM、不碰 localStorage，方便用 node 测试余额、区间汇总和助学金补记。
 *
 * 日期一律用 YYYY-MM-DD 字符串，并用 UTC 日历做加减，避免时区把「10 日」挪到 9 日。
 */

export const GRANT_AMOUNT = 500;
export const GRANT_WALLET_ID = 'grant';
export const GRANT_CATEGORY_ID = 'income-grant';

export const WALLET_DEFS = [
  { id: 'living', name: '生活费' },
  { id: 'scholarship', name: '奖学金' },
  { id: 'grant', name: '助学金' },
  { id: 'savings', name: '小金库' },
];

export const CATEGORY_DEFS = [
  { id: 'food', name: '餐饮', type: 'expense', icon: 'utensils' },
  { id: 'snack', name: '零食饮品', type: 'expense', icon: 'cup' },
  { id: 'transit', name: '交通', type: 'expense', icon: 'transit' },
  { id: 'shop', name: '购物', type: 'expense', icon: 'bag' },
  { id: 'daily', name: '日用', type: 'expense', icon: 'daily' },
  { id: 'beauty', name: '服饰美妆', type: 'expense', icon: 'beauty' },
  { id: 'fun', name: '娱乐', type: 'expense', icon: 'fun' },
  { id: 'study', name: '学习', type: 'expense', icon: 'study' },
  { id: 'med', name: '医疗', type: 'expense', icon: 'med' },
  { id: 'phone', name: '通讯', type: 'expense', icon: 'phone' },
  { id: 'home', name: '住房', type: 'expense', icon: 'home' },
  { id: 'gift', name: '人情礼物', type: 'expense', icon: 'gift' },
  { id: 'travel', name: '旅行', type: 'expense', icon: 'travel' },
  { id: 'exp-other', name: '其他', type: 'expense', icon: 'other' },
  { id: 'income-living', name: '生活费', type: 'income', icon: 'wallet' },
  { id: 'income-scholarship', name: '奖学金', type: 'income', icon: 'award' },
  { id: 'income-grant', name: '助学金', type: 'income', icon: 'grant' },
  { id: 'income-part', name: '兼职', type: 'income', icon: 'brief' },
  { id: 'income-red', name: '红包', type: 'income', icon: 'red' },
  { id: 'income-refund', name: '退款', type: 'income', icon: 'refund' },
  { id: 'income-other', name: '其他', type: 'income', icon: 'other' },
];

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function cents(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  // toFixed 先消掉二进制小数，再四舍五入到分。1.005 不能直接 Math.round(x * 100)。
  const sign = x < 0 ? -1 : 1;
  const scaled = Number((Math.abs(x) * 100).toFixed(8));
  return (sign * Math.round(scaled)) / 100;
}

export function uid(prefix = 'r') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(date = new Date()) {
  return formatISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export function formatISODate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = 星期日 … 6 = 星期六 */
export function weekday(iso) {
  const p = parseISODate(iso);
  if (!p) return 0;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export function addDays(iso, n) {
  const p = parseISODate(iso);
  if (!p) return iso;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return formatISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** m 是 1–12。delta 为月数，可负。 */
export function shiftMonth(y, m, delta) {
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = idx - ny * 12;
  return { y: ny, m: nm + 1 };
}

/** 周一为一周的第一天。 */
export function startOfWeek(iso) {
  const wd = weekday(iso);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDays(iso, offset);
}

export function eachDate(start, end) {
  if (!parseISODate(start) || !parseISODate(end)) return [];
  let a = start;
  let b = end;
  if (a > b) [a, b] = [b, a];
  const out = [];
  let cur = a;
  for (let i = 0; i < 4000 && cur <= b; i += 1) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function uniqueSortedDates(dates) {
  return [...new Set(dates)].filter((d) => parseISODate(d)).sort();
}

export function monthMatrix(year, month) {
  const first = formatISODate(year, month, 1);
  const last = formatISODate(year, month, daysInMonth(year, month));
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const weeks = [];
  let cur = start;
  while (cur <= end && weeks.length < 6) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cur);
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function monthPrefix(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function datesInMonth(year, month) {
  const n = daysInMonth(year, month);
  const out = [];
  for (let d = 1; d <= n; d += 1) out.push(formatISODate(year, month, d));
  return out;
}

export function formatMoney(n) {
  const v = cents(n);
  const neg = v < 0;
  const [i, d] = Math.abs(v).toFixed(2).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}¥${grouped}.${d}`;
}

export function formatSigned(n) {
  const v = cents(n);
  if (v > 0) return `+${formatMoney(v)}`;
  return formatMoney(v);
}

export function formatLongDate(iso) {
  const p = parseISODate(iso);
  if (!p) return '';
  return `${p.m}月${p.d}日 ${WEEKDAYS[weekday(iso)]}`;
}

export function formatMonthEn(month) {
  return MONTHS_EN[month - 1] || '';
}

export function formatMonthZh(month) {
  return MONTHS_ZH[month - 1] || '';
}

export function freshState() {
  return {
    version: 1,
    onboarded: false,
    setupDate: null,
    grantCreditedMonths: [],
    wallets: WALLET_DEFS.map((w) => ({ id: w.id, name: w.name, startBalance: 0 })),
    categories: CATEGORY_DEFS.map((c) => ({ ...c, builtin: true })),
    records: [],
  };
}

export function completeOnboarding(state, setupDate, balances) {
  if (!parseISODate(setupDate)) throw new Error('建账日期无效');
  return {
    ...state,
    onboarded: true,
    setupDate,
    grantCreditedMonths: [],
    records: [],
    wallets: state.wallets.map((w) => ({
      ...w,
      name: WALLET_DEFS.find((d) => d.id === w.id)?.name || w.name,
      startBalance: cents(balances?.[w.id] ?? 0),
    })),
  };
}

function isType(t) {
  return t === 'income' || t === 'expense';
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isType(raw.type)) return null;
  if (!WALLET_DEFS.some((w) => w.id === raw.walletId)) return null;
  if (!parseISODate(raw.date)) return null;
  const amount = cents(raw.amount);
  if (amount <= 0) return null;
  const id = String(raw.id || '');
  if (!id) return null;
  return {
    id,
    type: raw.type,
    amount,
    walletId: raw.walletId,
    categoryId: String(raw.categoryId || ''),
    note: String(raw.note || '').slice(0, 80),
    date: raw.date,
    auto: Boolean(raw.auto),
    createdAt: String(raw.createdAt || `${raw.date}T00:00:00.000Z`),
    updatedAt: String(raw.updatedAt || raw.createdAt || `${raw.date}T00:00:00.000Z`),
  };
}

/** 从自动入账记录上读出「哪个月已经发过」，避免补记时再写一笔。 */
export function grantKeyFromRecord(record) {
  const fromId = /^auto-grant-(\d{4}-\d{2})$/.exec(record?.id || '');
  if (fromId) return fromId[1];
  if (
    record?.auto &&
    record.walletId === GRANT_WALLET_ID &&
    /^\d{4}-\d{2}-10$/.test(record.date || '')
  ) {
    return record.date.slice(0, 7);
  }
  return null;
}

export function normalizeState(input) {
  const base = freshState();
  if (!input || typeof input !== 'object') return base;

  const extraCats = Array.isArray(input.categories) ? input.categories : [];
  const categories = base.categories.map((c) => {
    const found = extraCats.find((x) => x && x.id === c.id);
    if (!found) return c;
    const name = String(found.name || c.name).trim().slice(0, 12) || c.name;
    return { ...c, name };
  });
  for (const raw of extraCats) {
    if (!raw || categories.some((c) => c.id === raw.id)) continue;
    if (!isType(raw.type)) continue;
    const name = String(raw.name || '').trim().slice(0, 12);
    const id = String(raw.id || '');
    if (!name || !id) continue;
    categories.push({
      id,
      name,
      type: raw.type,
      icon: String(raw.icon || 'other'),
      builtin: false,
    });
  }

  const wallets = base.wallets.map((w) => {
    const found = (input.wallets || []).find((x) => x && x.id === w.id);
    return { ...w, startBalance: cents(found?.startBalance ?? 0) };
  });

  const records = (Array.isArray(input.records) ? input.records : [])
    .map(normalizeRecord)
    .filter(Boolean);

  const months = new Set(
    (Array.isArray(input.grantCreditedMonths) ? input.grantCreditedMonths : [])
      .filter((k) => /^\d{4}-\d{2}$/.test(String(k))),
  );
  for (const record of records) {
    const key = grantKeyFromRecord(record);
    if (key) months.add(key);
  }

  const setupDate = parseISODate(input.setupDate) ? input.setupDate : null;
  return {
    version: 1,
    onboarded: Boolean(input.onboarded) && Boolean(setupDate),
    setupDate,
    grantCreditedMonths: [...months].sort(),
    wallets,
    categories,
    records,
  };
}

/**
 * 助学金：自建账日起，每个月 10 日入账 ¥500。
 * 10 日早于建账日、或还没到的 10 日，都不记。
 * 已经记过的月份（含用户后来删掉的）放在 grantCreditedMonths 里，打开应用不会再补一遍。
 */
export function grantMonthsDue(setupDate, today) {
  const start = parseISODate(setupDate);
  const end = parseISODate(today);
  if (!start || !end || setupDate > today) return [];
  const months = [];
  let y = start.y;
  let m = start.m;
  const endIndex = end.y * 12 + (end.m - 1);
  for (let guard = 0; guard < 600; guard += 1) {
    if (y * 12 + (m - 1) > endIndex) break;
    const tenth = formatISODate(y, m, 10);
    if (tenth >= setupDate && tenth <= today) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    const next = shiftMonth(y, m, 1);
    y = next.y;
    m = next.m;
  }
  return months;
}

export function applyGrantBackfill(state, today) {
  if (!state?.onboarded || !state.setupDate || !parseISODate(today)) {
    return { state, added: [], changed: false };
  }
  const due = grantMonthsDue(state.setupDate, today);
  const credited = new Set(state.grantCreditedMonths || []);
  const ids = new Set(state.records.map((r) => r.id));
  const records = state.records.slice();
  const added = [];
  for (const key of due) {
    const id = `auto-grant-${key}`;
    if (credited.has(key) || ids.has(id)) {
      credited.add(key);
      continue;
    }
    const record = {
      id,
      type: 'income',
      amount: GRANT_AMOUNT,
      walletId: GRANT_WALLET_ID,
      categoryId: GRANT_CATEGORY_ID,
      note: '助学金（每月10日自动入账）',
      date: `${key}-10`,
      auto: true,
      createdAt: `${key}-10T02:00:00.000Z`,
      updatedAt: `${key}-10T02:00:00.000Z`,
    };
    records.push(record);
    ids.add(id);
    credited.add(key);
    added.push(record);
  }
  const grantCreditedMonths = [...credited].sort();
  const changed = added.length > 0
    || grantCreditedMonths.join(',') !== (state.grantCreditedMonths || []).join(',');
  if (!changed) return { state, added, changed: false };
  return {
    state: { ...state, records, grantCreditedMonths },
    added,
    changed: true,
  };
}

export function walletById(state, walletId) {
  return state.wallets.find((w) => w.id === walletId) || null;
}

export function categoryById(state, categoryId) {
  return state.categories.find((c) => c.id === categoryId) || null;
}

export function compareRecordsAsc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/** 当前余额 = 起始余额 + 收入 − 支出。untilDate 含当天。 */
export function walletBalance(state, walletId, untilDate = null) {
  const wallet = walletById(state, walletId);
  let bal = wallet ? wallet.startBalance : 0;
  for (const record of state.records) {
    if (record.walletId !== walletId) continue;
    if (untilDate && record.date > untilDate) continue;
    bal += record.type === 'income' ? record.amount : -record.amount;
  }
  return cents(bal);
}

export function runningLedger(state, walletId) {
  const wallet = walletById(state, walletId);
  let bal = wallet ? wallet.startBalance : 0;
  const rows = state.records
    .filter((r) => r.walletId === walletId)
    .slice()
    .sort(compareRecordsAsc);
  return rows.map((record) => {
    bal = cents(bal + (record.type === 'income' ? record.amount : -record.amount));
    return { record, balance: bal };
  });
}

export function expenseByCategory(state, walletId, dates = null) {
  const set = dates ? new Set(dates) : null;
  const map = new Map();
  for (const record of state.records) {
    if (record.walletId !== walletId || record.type !== 'expense') continue;
    if (set && !set.has(record.date)) continue;
    map.set(record.categoryId, (map.get(record.categoryId) || 0) + record.amount);
  }
  return [...map.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount: cents(amount) }))
    .sort((a, b) => b.amount - a.amount || (a.categoryId < b.categoryId ? -1 : 1));
}

/**
 * 一组日期上的收入、支出、结余，以及按分类、按钱包、按日的拆分。
 * dates 里重复的日期只算一次；没发生账的日期仍会出现在 byDate 里，方便画柱状图。
 */
export function summarize(state, dates, walletId = null) {
  const unique = uniqueSortedDates(dates);
  const set = new Set(unique);
  const byCategory = new Map();
  const byWallet = new Map();
  const byDate = new Map(unique.map((date) => [date, { date, income: 0, expense: 0 }]));
  let income = 0;
  let expense = 0;
  for (const record of state.records) {
    if (!set.has(record.date)) continue;
    if (walletId && record.walletId !== walletId) continue;
    const cat = byCategory.get(record.categoryId) || { categoryId: record.categoryId, income: 0, expense: 0 };
    const wal = byWallet.get(record.walletId) || { walletId: record.walletId, income: 0, expense: 0 };
    const day = byDate.get(record.date);
    if (record.type === 'income') {
      income += record.amount;
      cat.income += record.amount;
      wal.income += record.amount;
      day.income += record.amount;
    } else {
      expense += record.amount;
      cat.expense += record.amount;
      wal.expense += record.amount;
      day.expense += record.amount;
    }
    byCategory.set(record.categoryId, cat);
    byWallet.set(record.walletId, wal);
  }
  const roundRow = (row) => {
    const inc = cents(row.income);
    const exp = cents(row.expense);
    return { ...row, income: inc, expense: exp, net: cents(inc - exp) };
  };
  return {
    income: cents(income),
    expense: cents(expense),
    net: cents(income - expense),
    byCategory: [...byCategory.values()].map(roundRow).sort((a, b) => b.expense - a.expense || b.income - a.income),
    byWallet: [...byWallet.values()].map(roundRow).sort((a, b) => a.walletId.localeCompare(b.walletId)),
    byDate: [...byDate.values()].map((row) => roundRow(row)),
  };
}

export function recordsOnDate(state, date) {
  return state.records
    .filter((r) => r.date === date)
    .slice()
    .sort((a, b) => compareRecordsAsc(b, a));
}

export function dayIndicators(state, dates) {
  const map = {};
  for (const date of dates) map[date] = { income: 0, expense: 0 };
  const set = new Set(dates);
  for (const record of state.records) {
    if (!set.has(record.date)) continue;
    map[record.date][record.type] = cents(map[record.date][record.type] + record.amount);
  }
  return map;
}

export function parseAmount(raw) {
  if (raw == null) return 0;
  const text = String(raw).trim();
  if (!text || text === '.') return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return cents(n);
}

/** 自定义数字键盘：最多 7 位整数、2 位小数。 */
export function applyKey(amount, key) {
  const current = String(amount || '');
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return `${current === '' ? '0' : current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const base = current === '0' ? '' : current;
  const next = base + key;
  const [whole, frac] = next.split('.');
  if (whole.length > 7) return current;
  if (frac && frac.length > 2) return current;
  return next;
}

export function validateDraft(state, draft) {
  const errors = [];
  const amount = parseAmount(draft?.amount);
  if (!(amount > 0)) errors.push('请输入金额');
  const date = parseISODate(draft?.date) ? draft.date : null;
  if (!date) errors.push('请选择日期');
  if (!walletById(state, draft?.walletId)) errors.push('请选择钱包');
  const cat = categoryById(state, draft?.categoryId);
  if (!cat || cat.type !== draft?.type) errors.push('请选择分类');
  if (!isType(draft?.type)) errors.push('请选择收入或支出');
  return { ok: errors.length === 0, errors, amount, date };
}

export function upsertRecord(state, draft, nowIso) {
  const check = validateDraft(state, draft);
  if (!check.ok) return { state, errors: check.errors, record: null };
  const existing = draft.id ? state.records.find((r) => r.id === draft.id) : null;
  const record = {
    id: existing?.id || draft.id || uid('r'),
    type: draft.type,
    amount: check.amount,
    walletId: draft.walletId,
    categoryId: draft.categoryId,
    note: String(draft.note || '').trim().slice(0, 80),
    date: check.date,
    auto: Boolean(existing?.auto),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  const records = existing
    ? state.records.map((r) => (r.id === record.id ? record : r))
    : state.records.concat(record);
  return { state: { ...state, records }, errors: [], record };
}

export function deleteRecord(state, id) {
  const record = state.records.find((r) => r.id === id);
  if (!record) return state;
  const months = new Set(state.grantCreditedMonths || []);
  const key = grantKeyFromRecord(record);
  // 删掉自动入账也要记住这个月，下次打开不能再补一笔。
  if (key) months.add(key);
  return {
    ...state,
    grantCreditedMonths: [...months].sort(),
    records: state.records.filter((r) => r.id !== id),
  };
}

export function setStartBalances(state, balances) {
  return {
    ...state,
    wallets: state.wallets.map((w) => ({
      ...w,
      startBalance: Object.prototype.hasOwnProperty.call(balances || {}, w.id)
        ? cents(balances[w.id])
        : w.startBalance,
    })),
  };
}

export function setSetupDate(state, iso) {
  if (!parseISODate(iso)) return state;
  return { ...state, setupDate: iso };
}

export function renameCategory(state, id, name) {
  const next = String(name || '').trim().slice(0, 12);
  if (!next) return { state, error: '请填写分类名称' };
  if (!state.categories.some((c) => c.id === id)) return { state, error: '找不到分类' };
  return {
    state: {
      ...state,
      categories: state.categories.map((c) => (c.id === id ? { ...c, name: next } : c)),
    },
    error: '',
  };
}

export function addCategory(state, type, name) {
  const next = String(name || '').trim().slice(0, 12);
  if (!next) return { state, error: '请填写分类名称' };
  if (!isType(type)) return { state, error: '类型不对' };
  const categories = state.categories.concat({
    id: uid('cat'),
    name: next,
    type,
    icon: 'other',
    builtin: false,
  });
  return { state: { ...state, categories }, error: '' };
}

export function deleteCategory(state, id) {
  const cat = categoryById(state, id);
  if (!cat) return { state, error: '找不到分类' };
  if (cat.builtin) return { state, error: '默认分类可以改名，不能删除' };
  if (state.records.some((r) => r.categoryId === id)) {
    return { state, error: '已有记录使用该分类，只能改名' };
  }
  return {
    state: { ...state, categories: state.categories.filter((c) => c.id !== id) },
    error: '',
  };
}

export function parseBackup(json, today) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('这不是有效的记账本备份');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.records) || !Array.isArray(data.wallets)) {
    throw new Error('这不是有效的记账本备份');
  }
  const state = normalizeState(data);
  if (!state.setupDate) state.setupDate = parseISODate(today) ? today : null;
  if (state.setupDate) state.onboarded = true;
  if (!state.onboarded) throw new Error('备份里没有建账日期');
  return state;
}
