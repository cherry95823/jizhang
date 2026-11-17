/**
 * 界面层。账怎么算在 ledger.js，这里只负责把玻璃卡片画出来、把点击写成一笔账。
 */

import { barsSVG, CHART_COLORS, donutSVG } from './charts.js';
import { buildDemoState } from './demo.js';
import { icon } from './icons.js';
import {
  addCategory,
  addDays,
  applyGrantBackfill,
  applyKey,
  categoryById,
  cents,
  completeOnboarding,
  datesInMonth,
  dayIndicators,
  deleteCategory,
  deleteRecord,
  eachDate,
  expenseByCategory,
  formatLongDate,
  formatMoney,
  formatMonthEn,
  formatMonthZh,
  freshState,
  monthMatrix,
  monthPrefix,
  normalizeState,
  parseBackup,
  parseISODate,
  recordsOnDate,
  renameCategory,
  runningLedger,
  setSetupDate,
  setStartBalances,
  shiftMonth as shiftMonthIndex,
  startOfWeek,
  summarize,
  todayISO,
  uniqueSortedDates,
  upsertRecord,
  walletBalance,
  walletById,
  weekday,
} from './ledger.js';
import { clearRaw, loadRaw, saveRaw } from './storage.js';

const WEEK_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WEEK_SHORT = ['一', '二', '三', '四', '五', '六', '日'];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

let state;
let ui;
let paintedSheet = null;
let calMemo = null;
let toastTimer = 0;
let closing = false;
let suppressClick = false;
let gesture = null;

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function cls(parts) {
  return parts.filter(Boolean).join(' ');
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function calRow() {
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cal-row'));
  return Number.isFinite(n) ? n : 54;
}

function makeUI(today) {
  const p = parseISODate(today);
  return {
    tab: 'calendar',
    today,
    year: p.y,
    month: p.m,
    selected: today,
    view: 'month',
    weekAnchor: today,
    sheet: null,
    rangeKind: null,
    spanStart: null,
    spanEnd: null,
    multi: [],
    draft: null,
    activeId: null,
    confirm: null,
    walletId: null,
    expanded: {},
    catScope: 'all',
    toast: '',
    formError: '',
    editingCategoryId: null,
    categoryDraft: '',
    focusCategory: false,
  };
}

function boot() {
  const raw = loadRaw();
  state = raw ? normalizeState(raw) : freshState();
  ui = makeUI(todayISO());
  if (!state.onboarded) ui.sheet = 'onboard';
  else maybeBackfill(false);
  bind();
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function maybeBackfill(announce) {
  if (!state.onboarded) return;
  const filled = applyGrantBackfill(state, ui.today);
  if (!filled.changed) return;
  state = filled.state;
  persist();
  if (announce && filled.added.length) toast(`已补记助学金 ${filled.added.length} 笔`);
}

function persist() {
  try {
    saveRaw(state);
    return true;
  } catch {
    toast('保存失败，浏览器存储可能已满');
    return false;
  }
}

function toast(message) {
  ui.toast = message;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (ui.toast !== message) return;
    ui.toast = '';
    render();
  }, 2200);
}

function emptyDraft(date) {
  return {
    id: null,
    type: 'expense',
    amount: '',
    categoryId: '',
    walletId: '',
    note: '',
    date,
    auto: false,
  };
}

function readBalance(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return cents(text);
}

function balanceValue(n) {
  const c = cents(n);
  return Number.isInteger(c) ? String(c) : c.toFixed(2);
}

function amountMarkup(raw) {
  if (!raw) return '<span class="ghost">0.00</span>';
  return esc(raw);
}

function recordMeta(record) {
  const wallet = walletById(state, record.walletId)?.name || '';
  const note = String(record.note || '').trim();
  return note ? `${note} · ${wallet}` : wallet;
}

function summaryDates() {
  if (ui.rangeKind === 'span' && ui.spanStart && ui.spanEnd) return eachDate(ui.spanStart, ui.spanEnd);
  if (ui.rangeKind === 'multi') return uniqueSortedDates(ui.multi);
  return [];
}

function rangeReady() {
  return summaryDates().length > 0;
}

function netClass(n) {
  if (n > 0) return 'amt-in';
  if (n < 0) return 'amt-out';
  return '';
}

function render() {
  const root = document.getElementById('app');
  const previous = paintedSheet;
  const swap = Boolean(ui.sheet && previous && ui.sheet !== previous);
  const stay = Boolean(ui.sheet && previous && ui.sheet === previous);
  root.innerHTML = shell(swap || stay);
  const overlay = root.querySelector('.overlay');
  if (overlay && !overlay.classList.contains('show')) {
    requestAnimationFrame(() => overlay.classList.add('show'));
  } else if (overlay?.classList.contains('no-anim')) {
    requestAnimationFrame(() => overlay.classList.remove('no-anim'));
  }
  paintedSheet = ui.sheet;
  setupCalendarMotion();
  const edit = root.querySelector('[data-cat-edit]');
  if (edit && ui.focusCategory) {
    edit.focus();
    edit.select();
    ui.focusCategory = false;
  }
}

function shell(sheetVisible) {
  const ready = state.onboarded;
  return `
    ${ui.toast ? `<div class="toast glass" role="status">${esc(ui.toast)}</div>` : ''}
    ${ready ? view() : '<div class="boot-space"></div>'}
    ${ready ? dock() : ''}
    ${ready ? fab() : ''}
    ${sheet(sheetVisible)}
  `;
}

function view() {
  if (ui.tab === 'board') return viewBoard();
  if (ui.tab === 'wallet') return viewWallet();
  if (ui.tab === 'settings') return viewSettings();
  if (ui.tab === 'categories') return viewCategories();
  return viewCalendar();
}

function hero(kicker, title, sub, latinKicker = false, zhTitle = false) {
  return `<header class="hero">
    <p class="eyebrow${latinKicker ? ' latin' : ''}">${kicker}</p>
    <h1 class="hero-title${zhTitle ? ' zh' : ''}">${title}</h1>
    ${sub ? `<p class="hero-sub">${sub}</p>` : ''}
    <div class="ornament"></div>
  </header>`;
}

function viewCalendar() {
  const weeks = monthMatrix(ui.year, ui.month);
  let idx = weeks.findIndex((week) => week.includes(ui.view === 'week' ? ui.weekAnchor : ui.selected));
  if (idx < 0) idx = 0;
  const row = calRow();
  const rows = ui.view === 'week' ? 1 : weeks.length;
  const shift = ui.view === 'week' ? -idx * row : 0;
  const height = rows * row;
  const motion = `${ui.view}:${ui.year}-${ui.month}:${ui.view === 'week' ? weeks[idx][0] : 'all'}`;
  const flat = weeks.flat();
  const marks = dayIndicators(state, flat);
  const monthSum = summarize(state, datesInMonth(ui.year, ui.month));
  const cells = flat.map((date) => dayCell(date, marks[date])).join('');
  return `
    ${ui.view === 'week' ? '' : hero('本月', formatMonthEn(ui.month), `${formatMonthZh(ui.month)} · ${ui.year}`)}
    <section class="glass calendar" data-screen="calendar">
      <div class="cal-nav">
        <button type="button" class="nav-btn" data-action="${ui.view === 'week' ? 'shift-week' : 'shift-month'}" data-dir="-1" aria-label="${ui.view === 'week' ? '上一周' : '上个月'}">‹</button>
        <div class="cal-title">${formatMonthZh(ui.month)}</div>
        <button type="button" class="nav-btn" data-action="${ui.view === 'week' ? 'shift-week' : 'shift-month'}" data-dir="1" aria-label="${ui.view === 'week' ? '下一周' : '下个月'}">›</button>
      </div>
      <p class="cal-sum">收入 ${formatMoney(monthSum.income)} · 支出 ${formatMoney(monthSum.expense)}</p>
      <div class="weekdays">${WEEK_SHORT.map((name) => `<span>${name}</span>`).join('')}</div>
      <div class="cal-body" data-swipe="calendar" data-motion="${motion}" data-height="${height}px" data-shift="${shift}px" style="height:${height}px">
        <div class="cal-grid" style="transform:translateY(${shift}px)">${cells}</div>
      </div>
      ${ui.view === 'week' ? '<button type="button" class="text-btn" data-action="expand-month">展开整月</button>' : ''}
      ${rangeTools()}
    </section>
    ${ui.view === 'week' && !ui.rangeKind ? dayPanel() : ''}
  `;
}

function dayCell(date, mark) {
  const p = parseISODate(date);
  const outside = monthPrefix(p.y, p.m) !== monthPrefix(ui.year, ui.month);
  const classes = ['day'];
  if (outside) classes.push('is-out');
  if (date === ui.today) classes.push('is-today');
  if (!ui.rangeKind && ui.view === 'week' && date === ui.selected) classes.push('is-selected');
  if (ui.rangeKind === 'span' && ui.spanStart && ui.spanEnd && date >= ui.spanStart && date <= ui.spanEnd) {
    classes.push('is-in-range');
    if (date === ui.spanStart) classes.push('is-range-start');
    if (date === ui.spanEnd) classes.push('is-range-end');
  } else if (ui.rangeKind === 'span' && date === ui.spanStart) {
    classes.push('is-selected');
  }
  if (ui.rangeKind === 'multi' && ui.multi.includes(date)) classes.push('is-multi');
  const dots = [
    mark?.income > 0 ? '<i class="in"></i>' : '',
    mark?.expense > 0 ? '<i class="out"></i>' : '',
  ].join('');
  return `<button type="button" class="${classes.join(' ')}" data-action="pick-day" data-date="${date}" aria-label="${p.m}月${p.d}日">
    <span class="day-num">${p.d}</span>
    <span class="dots">${dots}</span>
  </button>`;
}

function rangeTools() {
  return `<div class="cal-tools">
      <button type="button" data-action="range-kind" data-kind="span" class="${ui.rangeKind === 'span' ? 'is-on' : ''}">连续</button>
      <button type="button" data-action="range-kind" data-kind="multi" class="${ui.rangeKind === 'multi' ? 'is-on' : ''}">多选</button>
      ${ui.rangeKind ? '<button type="button" data-action="range-kind" data-kind="">退出</button>' : ''}
    </div>
    ${rangeHint()}`;
}

function rangeHint() {
  if (ui.rangeKind === 'span' && !ui.spanEnd) {
    return `<p class="hint">${ui.spanStart ? '再点一天，定为结束' : '点一天作为开始'}</p>`;
  }
  if (ui.rangeKind === 'span' && ui.spanEnd) {
    return `<p class="hint">已选 ${eachDate(ui.spanStart, ui.spanEnd).length} 天</p>`;
  }
  if (ui.rangeKind === 'multi') {
    return `<p class="hint">${ui.multi.length ? `已选 ${ui.multi.length} 天，再点可取消` : '点选任意几天'}</p>`;
  }
  return '';
}

function dayPanel() {
  const p = parseISODate(ui.selected);
  const sum = summarize(state, [ui.selected]);
  const records = recordsOnDate(state, ui.selected);
  return `<section class="glass day-panel" data-screen="day">
    <div class="day-head">
      <p class="day-big num">${p.d}</p>
      <div>
        <p class="day-kicker">${formatMonthZh(p.m)}</p>
        <p class="day-week">${WEEK_FULL[weekday(ui.selected)]}</p>
      </div>
    </div>
    ${tri([
      { label: '当日收入', value: formatMoney(sum.income), className: 'amt-in' },
      { label: '当日支出', value: formatMoney(sum.expense), className: 'amt-out' },
      { label: '结余', value: formatMoney(sum.net), className: netClass(sum.net) },
    ])}
    ${records.length ? records.map((record) => recordRow(record)).join('') : '<p class="empty">这一天还没有记录</p>'}
  </section>`;
}

function tri(items) {
  return `<div class="tri">${items.map((item) => `
    <div class="cell">
      <p class="lbl">${item.label}</p>
      <p class="val num ${item.className || ''}">${item.value}</p>
    </div>`).join('')}</div>`;
}

function recordRow(record, balance = null) {
  const cat = categoryById(state, record.categoryId);
  const sign = record.type === 'income' ? `+${formatMoney(record.amount)}` : formatMoney(-record.amount);
  return `<button type="button" class="record" data-action="open-record" data-id="${esc(record.id)}">
    <span class="record-icon">${icon(cat?.icon || 'other')}</span>
    <span class="record-main">
      <span class="record-title">${esc(cat?.name || '未分类')}${record.auto ? '<i class="badge">自动</i>' : ''}</span>
      <span class="record-note">${esc(recordMeta(record))}</span>
    </span>
    <span class="record-side">
      <span class="record-amt num ${record.type === 'income' ? 'amt-in' : 'amt-out'}">${sign}</span>
      ${balance == null ? '' : `<span class="flow-balance num">余 ${formatMoney(balance)}</span>`}
    </span>
  </button>`;
}

function viewBoard() {
  const p = parseISODate(ui.today);
  const monthDates = datesInMonth(p.y, p.m);
  const cards = state.wallets.map((wallet) => {
    const sum = summarize(state, monthDates, wallet.id);
    return `<button type="button" class="glass wallet-card" data-action="open-wallet" data-id="${wallet.id}">
      <span class="eyebrow">钱包</span>
      <span class="wallet-name">${esc(wallet.name)}</span>
      <span class="wallet-bal num">${formatMoney(walletBalance(state, wallet.id))}</span>
      <span class="pair"><span>本月收入</span><span class="num amt-in">${formatMoney(sum.income)}</span></span>
      <span class="pair"><span>本月支出</span><span class="num amt-out">${formatMoney(sum.expense)}</span></span>
    </button>`;
  }).join('');
  return `
    ${hero('Wallets', '看板', '点开一只钱包，看它的来路', true, true)}
    <div class="board-grid" data-screen="board">${cards}</div>
  `;
}

function viewWallet() {
  const wallet = walletById(state, ui.walletId) || state.wallets[0];
  const p = parseISODate(ui.today);
  const monthDates = datesInMonth(p.y, p.m);
  const sum = summarize(state, monthDates, wallet.id);
  const flow = runningLedger(state, wallet.id).slice().reverse();
  const categoryBlock = wallet.id === 'living' ? livingCategories(wallet.id, monthDates) : '';
  return `
    <button type="button" class="back-link" data-action="back-board">${icon('back')}<span>看板</span></button>
    ${hero('Balance', esc(wallet.name), '', true, true)}
    <section class="glass detail-block" data-screen="wallet">
      <p class="eyebrow">当前余额</p>
      <p class="wallet-bal num">${formatMoney(walletBalance(state, wallet.id))}</p>
      ${tri([
        { label: '本月收入', value: formatMoney(sum.income), className: 'amt-in' },
        { label: '本月支出', value: formatMoney(sum.expense), className: 'amt-out' },
        { label: '本月结余', value: formatMoney(sum.net), className: netClass(sum.net) },
      ])}
    </section>
    ${categoryBlock}
    <section class="glass detail-block">
      <h2 class="section-title">${wallet.id === 'living' ? '余额流水' : '逐笔记账'}</h2>
      ${flow.length
        ? flow.map((row) => recordRow(row.record, row.balance)).join('')
        : '<p class="empty">还没有进出账</p>'}
      <p class="hint">起始 ${formatMoney(wallet.startBalance)}</p>
    </section>
  `;
}

function livingCategories(walletId, monthDates) {
  const dates = ui.catScope === 'month' ? monthDates : null;
  const rows = expenseByCategory(state, walletId, dates);
  const body = rows.length ? rows.map((row) => {
    const cat = categoryById(state, row.categoryId);
    const open = Boolean(ui.expanded[row.categoryId]);
    const children = open ? categoryRecords(walletId, row.categoryId, dates) : [];
    return `<div>
      <button type="button" class="cat-row${open ? ' is-open' : ''}" data-action="toggle-cat" data-id="${esc(row.categoryId)}">
        <span class="record-icon">${icon(cat?.icon || 'other')}</span>
        <span>${esc(cat?.name || '未分类')}</span>
        <span class="num amt-out">${formatMoney(row.amount)}</span>
        <span class="chev">${icon('chevron')}</span>
      </button>
      ${open ? `<div class="cat-children">${children.map((record) => recordRow(record)).join('') || ''}</div>` : ''}
    </div>`;
  }).join('') : '<p class="empty">还没有支出</p>';
  return `<section class="glass detail-block">
    <h2 class="section-title">支出分类</h2>
    <div class="seg slim">
      <button type="button" data-action="cat-scope" data-scope="month" class="${ui.catScope === 'month' ? 'is-on' : ''}">本月</button>
      <button type="button" data-action="cat-scope" data-scope="all" class="${ui.catScope === 'all' ? 'is-on' : ''}">全部</button>
    </div>
    ${body}
  </section>`;
}

function categoryRecords(walletId, categoryId, dates) {
  const set = dates ? new Set(dates) : null;
  return state.records
    .filter((record) => record.walletId === walletId && record.categoryId === categoryId && record.type === 'expense' && (!set || set.has(record.date)))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function viewSettings() {
  return `
    ${hero('Settings', '设置', '账只留在这台设备上', true, true)}
    <section class="glass set-block" data-screen="settings">
      <h2>起始余额</h2>
      <p class="lede">这是建账时钱包里已经有的钱，不是后来的收入。改这里会立刻改掉当前余额。</p>
      ${state.wallets.map((wallet) => `
        <label class="balance-row">
          <span>${esc(wallet.name)}</span>
          <input data-balance="${wallet.id}" inputmode="decimal" autocomplete="off" value="${balanceValue(wallet.startBalance)}" aria-label="${esc(wallet.name)}起始余额" />
        </label>`).join('')}
      <button type="button" class="btn-primary stack-btn" data-action="save-balances">保存余额</button>
    </section>
    <section class="glass set-block">
      <h2>助学金起算日</h2>
      <p class="lede">从这一天起，每个月 10 日自动记 ¥500 到助学金。已经记过的月份不会再记一遍；删掉的那笔也不会自动回来。</p>
      <label class="balance-row">
        <span>起算</span>
        <input data-field="setup" type="date" value="${esc(state.setupDate || ui.today)}" />
      </label>
      <button type="button" class="btn-primary stack-btn" data-action="save-setup">保存起算日</button>
    </section>
    <section class="glass set-block">
      <h2>分类</h2>
      <button type="button" class="link-row" data-action="open-categories"><span>管理分类</span>${icon('chevron')}</button>
    </section>
    <section class="glass set-block">
      <h2>备份</h2>
      <p class="lede">换手机之前先导出。导入会替换这台设备上的账本。</p>
      <button type="button" class="btn-primary" data-action="export-json">导出备份</button>
      <button type="button" class="btn-quiet" data-action="pick-import">导入备份</button>
      <input id="import-file" type="file" accept="application/json,.json" hidden />
    </section>
    <section class="glass set-block">
      <h2>示例</h2>
      <p class="lede">载入一组演示账单，方便看看界面。正式使用不会自己填数据。已有的账会被换掉。</p>
      <button type="button" class="btn-quiet" data-action="ask-demo">载入示例数据</button>
    </section>
    <section class="glass set-block">
      <h2>清空</h2>
      <p class="lede">删掉这台设备上的全部账本，回到最初的空白。</p>
      <button type="button" class="btn-danger" data-action="ask-clear">清空所有数据</button>
    </section>
  `;
}

function viewCategories() {
  const groups = [
    ['expense', '支出'],
    ['income', '收入'],
  ];
  const blocks = groups.map(([type, label]) => {
    const cats = state.categories.filter((cat) => cat.type === type);
    return `<section class="glass set-block">
      <h2>${label}</h2>
      ${cats.map((cat) => categoryLine(cat)).join('')}
      <div class="add-row">
        <input data-new-cat="${type}" maxlength="12" placeholder="新分类" aria-label="新的${label}分类" />
        <button type="button" class="mini" data-action="add-cat" data-type="${type}">添加</button>
      </div>
    </section>`;
  }).join('');
  return `
    <button type="button" class="back-link" data-action="back-settings">${icon('back')}<span>设置</span></button>
    ${hero('Categories', '分类', '默认的可以改名，自己加的没用过就能删', true, true)}
    <div data-screen="categories">${blocks}</div>
  `;
}

function categoryLine(cat) {
  if (ui.editingCategoryId === cat.id) {
    return `<div class="cat-line">
      ${icon(cat.icon)}
      <input class="rename-input" data-field="rename" data-cat-edit value="${esc(ui.categoryDraft)}" maxlength="12" />
      <button type="button" class="mini" data-action="commit-rename">完成</button>
      <button type="button" class="mini" data-action="cancel-rename">取消</button>
    </div>`;
  }
  return `<div class="cat-line">
    ${icon(cat.icon)}
    <span>${esc(cat.name)}</span>
    <button type="button" class="mini" data-action="start-rename" data-id="${esc(cat.id)}">改名</button>
    ${cat.builtin ? '<span></span>' : `<button type="button" class="mini" data-action="delete-cat" data-id="${esc(cat.id)}">删除</button>`}
  </div>`;
}

function dock() {
  const items = [
    ['calendar', '日历', 'calendar'],
    ['board', '看板', 'board'],
    ['settings', '设置', 'sliders'],
  ];
  const on = ui.tab === 'wallet' ? 'board' : ui.tab === 'categories' ? 'settings' : ui.tab;
  return `<nav class="dock glass" aria-label="主导航">${items.map(([id, label, name]) => `
    <button type="button" data-action="tab" data-tab="${id}" class="${on === id ? 'is-on' : ''}" ${on === id ? 'aria-current="page"' : ''}>
      ${icon(name)}<span>${label}</span>
    </button>`).join('')}</nav>`;
}

function fab() {
  if (ui.tab !== 'calendar') return '';
  if (ui.rangeKind && rangeReady()) {
    return '<button type="button" class="fab glass" data-action="open-summary">查看汇总</button>';
  }
  if (ui.rangeKind) return '';
  return '<button type="button" class="fab glass" data-action="open-add">记一笔</button>';
}

function sheet(sheetVisible) {
  if (!ui.sheet) return '';
  const centered = ui.sheet === 'onboard' || ui.sheet === 'confirm';
  const showClass = sheetVisible ? 'show no-anim' : '';
  let body = '';
  if (ui.sheet === 'onboard') body = onboardCard();
  else if (ui.sheet === 'confirm') body = confirmCard();
  else if (ui.sheet === 'add') body = addSheet();
  else if (ui.sheet === 'record') body = recordSheet();
  else if (ui.sheet === 'summary') body = summarySheet();
  return `<div class="${cls(['overlay', centered && 'center', showClass])}" data-action="scrim">${body}</div>`;
}

function onboardCard() {
  return `<div class="glass modal" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
    <p class="eyebrow latin">Begin</p>
    <h2 id="onboard-title" class="modal-title">写下起点</h2>
    <p class="lede">四只钱包的起始余额。还没有进出账，就填 0。之后可以在设置里改。</p>
    ${state.wallets.map((wallet) => `
      <label class="balance-row">
        <span>${esc(wallet.name)}</span>
        <input data-balance="${wallet.id}" inputmode="decimal" autocomplete="off" value="${esc(ui.balanceDraft?.[wallet.id] ?? '0')}" aria-label="${esc(wallet.name)}起始余额" />
      </label>`).join('')}
    ${ui.formError ? `<p class="form-error">${esc(ui.formError)}</p>` : ''}
    <button type="button" class="btn-primary stack-btn" data-action="onboard-save">开始记账</button>
  </div>`;
}

function confirmCard() {
  const confirm = ui.confirm || { title: '', body: '', ok: '确定' };
  return `<div class="glass modal" role="dialog" aria-modal="true">
    <h2 class="modal-title">${esc(confirm.title)}</h2>
    <p class="lede">${esc(confirm.body)}</p>
    <button type="button" class="btn-primary" data-action="confirm-yes">${esc(confirm.ok)}</button>
    <button type="button" class="btn-quiet" data-action="close-sheet">取消</button>
  </div>`;
}

function addSheet() {
  const draft = ui.draft;
  const cats = state.categories.filter((cat) => cat.type === draft.type);
  return `<div class="glass sheet form" role="dialog" aria-modal="true" aria-labelledby="add-title">
    <div class="handle"></div>
    <div class="sheet-head">
      <h2 id="add-title">${draft.id ? '改一笔' : '记一笔'}</h2>
      <button type="button" class="icon-btn" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
    </div>
    <div class="seg">
      <button type="button" data-action="set-type" data-type="expense" class="${draft.type === 'expense' ? 'is-on' : ''}">支出</button>
      <button type="button" data-action="set-type" data-type="income" class="${draft.type === 'income' ? 'is-on' : ''}">收入</button>
    </div>
    <div class="amount-line num"><span class="currency">¥</span><span data-amount>${amountMarkup(draft.amount)}</span></div>
    <div class="sheet-scroll">
      <p class="field-label">分类</p>
      <div class="cat-grid">
        ${cats.map((cat) => `
          <button type="button" class="cat${draft.categoryId === cat.id ? ' is-on' : ''}" data-action="pick-category" data-id="${esc(cat.id)}">
            ${icon(cat.icon)}<span>${esc(cat.name)}</span>
          </button>`).join('')}
      </div>
      <p class="field-label">钱包</p>
      <div class="wallet-picks">
        ${state.wallets.map((wallet) => `
          <button type="button" class="wallet-chip${draft.walletId === wallet.id ? ' is-on' : ''}" data-action="pick-wallet" data-id="${wallet.id}">${esc(wallet.name)}</button>`).join('')}
      </div>
      <div class="meta-row">
        <label class="field">
          <p class="field-label">备注</p>
          <input data-field="note" maxlength="80" placeholder="可留空" value="${esc(draft.note)}" />
        </label>
        <label class="field">
          <p class="field-label">日期</p>
          <input data-field="date" type="date" value="${esc(draft.date)}" />
        </label>
      </div>
    </div>
    <div class="sheet-footer">
      ${ui.formError ? `<p class="form-error">${esc(ui.formError)}</p>` : ''}
      <div class="keypad">
        ${KEYS.map((key) => `
          <button type="button" class="key" data-action="key" data-key="${key}" aria-label="${key === 'back' ? '退格' : key}">${key === 'back' ? icon('backspace') : key}</button>`).join('')}
      </div>
      <button type="button" class="btn-primary" data-action="save-record">保存</button>
    </div>
  </div>`;
}

function recordSheet() {
  const record = state.records.find((item) => item.id === ui.activeId);
  if (!record) return '';
  const cat = categoryById(state, record.categoryId);
  const sign = record.type === 'income' ? `+${formatMoney(record.amount)}` : formatMoney(-record.amount);
  return `<div class="glass sheet page" role="dialog" aria-modal="true">
    <div class="handle"></div>
    <div class="sheet-head">
      <h2>${esc(cat?.name || '未分类')}${record.auto ? '<i class="badge">自动</i>' : ''}</h2>
      <button type="button" class="icon-btn" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
    </div>
    <div class="sheet-detail">
      <p class="detail-amount num ${record.type === 'income' ? 'amt-in' : 'amt-out'}">${sign}</p>
      <p class="hint">${esc(formatLongDate(record.date))} · ${esc(walletById(state, record.walletId)?.name || '')}</p>
      ${record.note ? `<p class="lede" style="text-align:center">${esc(record.note)}</p>` : ''}
      <button type="button" class="btn-primary stack-btn" data-action="edit-record">编辑</button>
      <button type="button" class="btn-danger" data-action="ask-delete">删除</button>
    </div>
  </div>`;
}

function summarySheet() {
  const dates = summaryDates();
  const sum = summarize(state, dates);
  const expenses = sum.byCategory.filter((row) => row.expense > 0);
  const incomes = sum.byCategory.filter((row) => row.income > 0);
  const slices = expenses.map((row, index) => ({
    value: row.expense,
    color: CHART_COLORS[index % CHART_COLORS.length],
    label: categoryById(state, row.categoryId)?.name || '未分类',
  }));
  const label = dates.length === 1
    ? formatLongDate(dates[0])
    : ui.rangeKind === 'multi'
      ? `已选 ${dates.length} 天`
      : `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`;
  const wallets = state.wallets.map((wallet) => {
    const row = sum.byWallet.find((item) => item.walletId === wallet.id) || { income: 0, expense: 0, net: 0 };
    return { name: wallet.name, ...row };
  });
  return `<div class="glass sheet page tall" role="dialog" aria-modal="true" data-screen="summary">
    <div class="handle"></div>
    <div class="sheet-head">
      <h2>区间汇总</h2>
      <button type="button" class="icon-btn" data-action="close-sheet" aria-label="关闭">${icon('close')}</button>
    </div>
    <p class="hint">${esc(label)}</p>
    ${tri([
      { label: '收入', value: formatMoney(sum.income), className: 'amt-in' },
      { label: '支出', value: formatMoney(sum.expense), className: 'amt-out' },
      { label: '结余', value: formatMoney(sum.net), className: netClass(sum.net) },
    ])}
    <h3 class="section-title">支出构成</h3>
    ${slices.length ? `<div class="chart-row">${donutSVG(slices, formatMoney(sum.expense))}<ul class="legend">${slices.map((slice) => `
      <li><i style="background:${slice.color}"></i><span>${esc(slice.label)}</span><em>${formatMoney(slice.value)}</em></li>`).join('')}</ul></div>` : '<p class="empty">这段时间没有支出</p>'}
    <h3 class="section-title">每日</h3>
    ${barsSVG(sum.byDate)}
    <p class="legend-note"><span><i style="background:#7E9A84"></i>收入</span><span><i style="background:#C98996"></i>支出</span></p>
    <h3 class="section-title">按钱包</h3>
    ${wallets.map((row) => `
      <div class="break-row">
        <span>${esc(row.name)}</span>
        <span class="num amt-in">${formatMoney(row.income)}</span>
        <span class="num amt-out">${formatMoney(row.expense)}</span>
        <span class="num ${netClass(row.net)}">${formatMoney(row.net)}</span>
      </div>`).join('')}
    <h3 class="section-title">按分类</h3>
    ${expenses.map((row) => `
      <div class="break-row">
        <span>${esc(categoryById(state, row.categoryId)?.name || '未分类')}</span>
        <span></span><span></span>
        <span class="num amt-out">${formatMoney(row.expense)}</span>
      </div>`).join('')}
    ${incomes.map((row) => `
      <div class="break-row">
        <span>${esc(categoryById(state, row.categoryId)?.name || '未分类')}</span>
        <span class="num amt-in">${formatMoney(row.income)}</span>
        <span></span><span></span>
      </div>`).join('')}
  </div>`;
}

function shortDate(iso) {
  const p = parseISODate(iso);
  return `${p.m}月${p.d}日`;
}

function openDay(date) {
  const p = parseISODate(date);
  const outside = monthPrefix(p.y, p.m) !== monthPrefix(ui.year, ui.month);
  ui.selected = date;
  ui.weekAnchor = date;
  ui.view = 'week';
  if (outside) {
    ui.year = p.y;
    ui.month = p.m;
  }
}

function pickDay(date) {
  if (ui.rangeKind === 'span') {
    if (!ui.spanStart || ui.spanEnd) {
      ui.spanStart = date;
      ui.spanEnd = null;
    } else {
      ui.spanEnd = date;
      if (ui.spanEnd < ui.spanStart) {
        const tmp = ui.spanStart;
        ui.spanStart = ui.spanEnd;
        ui.spanEnd = tmp;
      }
    }
    return;
  }
  if (ui.rangeKind === 'multi') {
    const index = ui.multi.indexOf(date);
    if (index >= 0) ui.multi.splice(index, 1);
    else ui.multi.push(date);
    ui.multi.sort();
    return;
  }
  if (ui.view === 'week') {
    ui.selected = date;
    ui.weekAnchor = date;
    return;
  }
  openDay(date);
}

function shiftWeek(dir) {
  const weeks = monthMatrix(ui.year, ui.month);
  let idx = weeks.findIndex((week) => week.includes(ui.weekAnchor));
  if (idx < 0) idx = 0;
  const next = idx + dir;
  if (next >= 0 && next < weeks.length) {
    focusWeek(weeks[next]);
    return;
  }
  const landing = addDays(weeks[idx][0], dir * 7);
  const anchor = startOfWeek(landing);
  const thursday = parseISODate(addDays(anchor, 3));
  ui.year = thursday.y;
  ui.month = thursday.m;
  const moved = monthMatrix(ui.year, ui.month).find((week) => week.includes(anchor));
  focusWeek(moved || monthMatrix(ui.year, ui.month)[0]);
}

function focusWeek(week) {
  const index = weekday(ui.selected);
  const slot = index === 0 ? 6 : index - 1;
  ui.weekAnchor = week[slot];
  ui.selected = week[slot];
  ui.view = 'week';
}

function closeSheet() {
  if (closing || !ui.sheet || ui.sheet === 'onboard') return;
  const overlay = document.querySelector('.overlay');
  if (!overlay || reducedMotion() || overlay.classList.contains('no-anim')) {
    ui.sheet = null;
    ui.formError = '';
    ui.confirm = null;
    paintedSheet = null;
    render();
    return;
  }
  closing = true;
  overlay.classList.remove('show');
  const done = () => {
    if (!closing) return;
    closing = false;
    ui.sheet = null;
    ui.formError = '';
    ui.confirm = null;
    paintedSheet = null;
    render();
  };
  overlay.addEventListener('transitionend', (event) => {
    if (event.target === overlay && event.propertyName === 'opacity') done();
  });
  setTimeout(done, 520);
}

function ask(kind, title, body, ok) {
  ui.confirm = { kind, title, body, ok };
  ui.sheet = 'confirm';
  render();
}

function saveRecord() {
  const result = upsertRecord(state, ui.draft, new Date().toISOString());
  if (result.errors.length) {
    ui.formError = result.errors[0];
    render();
    return;
  }
  state = result.state;
  if (!persist()) return;
  const date = result.record.date;
  const p = parseISODate(date);
  ui.sheet = null;
  ui.draft = null;
  ui.formError = '';
  ui.rangeKind = null;
  ui.selected = date;
  ui.weekAnchor = date;
  ui.year = p.y;
  ui.month = p.m;
  ui.view = 'week';
  ui.tab = 'calendar';
  toast('已记下');
}

function loadDemo() {
  state = buildDemoState(ui.today);
  if (!persist()) return;
  const today = ui.today;
  ui = makeUI(today);
  toast('已载入示例');
}

function commitRename() {
  if (!ui.editingCategoryId) return;
  const result = renameCategory(state, ui.editingCategoryId, ui.categoryDraft);
  ui.editingCategoryId = null;
  if (result.error) {
    toast(result.error);
    return;
  }
  state = result.state;
  if (!persist()) return;
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `jizhang-${state.setupDate || ui.today}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast('已导出备份');
}

async function importFile(file) {
  try {
    const text = await file.text();
    state = parseBackup(text, ui.today);
    const filled = applyGrantBackfill(state, ui.today);
    state = filled.state;
    if (!persist()) return;
    const today = ui.today;
    ui = makeUI(today);
    toast(filled.added.length ? `已导入，并补记助学金 ${filled.added.length} 笔` : '已导入备份');
  } catch (error) {
    toast(error.message || '导入失败');
  }
}

function onClick(event) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target || !document.getElementById('app').contains(target)) return;
  const action = target.dataset.action;
  if (action === 'scrim') {
    if (event.target !== target || ui.sheet === 'onboard') return;
    closeSheet();
    return;
  }
  if (action === 'tab') {
    ui.tab = target.dataset.tab;
    render();
    return;
  }
  if (action === 'shift-month') {
    const next = shiftMonthIndex(ui.year, ui.month, Number(target.dataset.dir));
    ui.year = next.y;
    ui.month = next.m;
    ui.view = 'month';
    render();
    return;
  }
  if (action === 'shift-week') {
    shiftWeek(Number(target.dataset.dir));
    render();
    return;
  }
  if (action === 'pick-day') {
    pickDay(target.dataset.date);
    render();
    return;
  }
  if (action === 'expand-month') {
    const p = parseISODate(ui.selected);
    ui.view = 'month';
    ui.year = p.y;
    ui.month = p.m;
    render();
    return;
  }
  if (action === 'range-kind') {
    ui.rangeKind = target.dataset.kind || null;
    if (!ui.rangeKind) {
      ui.spanStart = null;
      ui.spanEnd = null;
      ui.multi = [];
    } else ui.view = 'month';
    render();
    return;
  }
  if (action === 'open-summary') {
    if (!rangeReady()) return;
    ui.sheet = 'summary';
    render();
    return;
  }
  if (action === 'open-add') {
    ui.draft = emptyDraft(ui.selected || ui.today);
    ui.formError = '';
    ui.sheet = 'add';
    render();
    return;
  }
  if (action === 'close-sheet') {
    closeSheet();
    return;
  }
  if (action === 'set-type') {
    ui.draft.type = target.dataset.type;
    const cat = categoryById(state, ui.draft.categoryId);
    if (!cat || cat.type !== ui.draft.type) ui.draft.categoryId = '';
    ui.formError = '';
    render();
    return;
  }
  if (action === 'pick-category') {
    ui.draft.categoryId = target.dataset.id;
    ui.formError = '';
    render();
    return;
  }
  if (action === 'pick-wallet') {
    ui.draft.walletId = target.dataset.id;
    ui.formError = '';
    render();
    return;
  }
  if (action === 'key') {
    ui.draft.amount = applyKey(ui.draft.amount, target.dataset.key);
    const node = document.querySelector('[data-amount]');
    if (node) node.innerHTML = amountMarkup(ui.draft.amount);
    ui.formError = '';
    document.querySelector('.form-error')?.remove();
    return;
  }
  if (action === 'save-record') {
    saveRecord();
    return;
  }
  if (action === 'open-record') {
    ui.activeId = target.dataset.id;
    ui.sheet = 'record';
    render();
    return;
  }
  if (action === 'edit-record') {
    const record = state.records.find((item) => item.id === ui.activeId);
    if (!record) return;
    ui.draft = {
      id: record.id,
      type: record.type,
      amount: balanceValue(record.amount),
      categoryId: record.categoryId,
      walletId: record.walletId,
      note: record.note,
      date: record.date,
    };
    ui.formError = '';
    ui.sheet = 'add';
    render();
    return;
  }
  if (action === 'ask-delete') {
    ask('delete', '删除这笔？', '删掉之后，当天的收入和支出会马上重算。', '删除');
    return;
  }
  if (action === 'confirm-yes') {
    const kind = ui.confirm?.kind;
    if (kind === 'delete') {
      state = deleteRecord(state, ui.activeId);
      if (!persist()) return;
      ui.sheet = null;
      ui.confirm = null;
      ui.activeId = null;
      paintedSheet = null;
      toast('已删除');
      return;
    }
    if (kind === 'clear') {
      clearRaw();
      state = freshState();
      const today = ui.today;
      ui = makeUI(today);
      ui.sheet = 'onboard';
      toast('已清空');
      return;
    }
    if (kind === 'demo') loadDemo();
    return;
  }
  if (action === 'open-wallet') {
    ui.walletId = target.dataset.id;
    ui.tab = 'wallet';
    ui.expanded = {};
    render();
    return;
  }
  if (action === 'back-board') {
    ui.tab = 'board';
    render();
    return;
  }
  if (action === 'toggle-cat') {
    const id = target.dataset.id;
    ui.expanded[id] = !ui.expanded[id];
    render();
    return;
  }
  if (action === 'cat-scope') {
    ui.catScope = target.dataset.scope;
    render();
    return;
  }
  if (action === 'save-balances') {
    const balances = {};
    for (const wallet of state.wallets) {
      const value = readBalance(document.querySelector(`[data-balance="${wallet.id}"]`)?.value);
      if (value == null) {
        toast('起始余额请填数字');
        return;
      }
      balances[wallet.id] = value;
    }
    state = setStartBalances(state, balances);
    if (!persist()) return;
    toast('已保存起始余额');
    return;
  }
  if (action === 'save-setup') {
    const value = document.querySelector('[data-field="setup"]')?.value;
    if (!parseISODate(value)) {
      toast('日期无效');
      return;
    }
    state = setSetupDate(state, value);
    const filled = applyGrantBackfill(state, ui.today);
    state = filled.state;
    if (!persist()) return;
    toast(filled.added.length ? `已补记助学金 ${filled.added.length} 笔` : '已保存起算日');
    return;
  }
  if (action === 'export-json') {
    exportJson();
    return;
  }
  if (action === 'pick-import') {
    document.getElementById('import-file')?.click();
    return;
  }
  if (action === 'ask-demo') {
    ask('demo', '载入示例？', '现在的账本会被一整组演示账单换掉。', '替换');
    return;
  }
  if (action === 'ask-clear') {
    ask('clear', '全部清空？', '这台设备上的账本会消失，而且找不回来。', '清空');
    return;
  }
  if (action === 'open-categories') {
    ui.tab = 'categories';
    ui.editingCategoryId = null;
    render();
    return;
  }
  if (action === 'back-settings') {
    ui.tab = 'settings';
    render();
    return;
  }
  if (action === 'start-rename') {
    ui.editingCategoryId = target.dataset.id;
    ui.categoryDraft = categoryById(state, target.dataset.id)?.name || '';
    ui.focusCategory = true;
    render();
    return;
  }
  if (action === 'commit-rename') {
    commitRename();
    return;
  }
  if (action === 'cancel-rename') {
    ui.editingCategoryId = null;
    render();
    return;
  }
  if (action === 'add-cat') {
    const name = document.querySelector(`[data-new-cat="${target.dataset.type}"]`)?.value || '';
    const result = addCategory(state, target.dataset.type, name);
    if (result.error) {
      toast(result.error);
      return;
    }
    state = result.state;
    if (!persist()) return;
    toast('已添加分类');
    return;
  }
  if (action === 'delete-cat') {
    const result = deleteCategory(state, target.dataset.id);
    if (result.error) {
      toast(result.error);
      return;
    }
    state = result.state;
    if (!persist()) return;
    toast('已删除分类');
    return;
  }
  if (action === 'onboard-save') {
    const balances = {};
    for (const wallet of state.wallets) {
      const value = readBalance(document.querySelector(`[data-balance="${wallet.id}"]`)?.value);
      if (value == null) {
        ui.formError = '起始余额请填数字';
        render();
        return;
      }
      balances[wallet.id] = value;
    }
    state = completeOnboarding(state, ui.today, balances);
    const filled = applyGrantBackfill(state, ui.today);
    state = filled.state;
    if (!persist()) return;
    ui.sheet = null;
    ui.formError = '';
    toast(filled.added.length ? `已入账助学金 ${filled.added.length} 笔` : '账本准备好了');
  }
}

function onInput(event) {
  const el = event.target;
  if (el.dataset.field === 'note' && ui.draft) ui.draft.note = el.value;
  if (el.dataset.field === 'date' && ui.draft) ui.draft.date = el.value;
  if (el.dataset.field === 'rename') ui.categoryDraft = el.value;
  if (el.dataset.balance && ui.sheet === 'onboard') {
    ui.balanceDraft = ui.balanceDraft || {};
    ui.balanceDraft[el.dataset.balance] = el.value;
  }
}

function onChange(event) {
  const el = event.target;
  if (el.dataset.field === 'date' && ui.draft) ui.draft.date = el.value;
  if (el.id === 'import-file' && el.files?.[0]) {
    const file = el.files[0];
    el.value = '';
    importFile(file);
  }
}

function setupCalendarMotion() {
  const body = document.querySelector('.cal-body');
  if (!body) {
    calMemo = null;
    return;
  }
  const grid = body.querySelector('.cal-grid');
  const height = body.dataset.height;
  const shift = body.dataset.shift;
  const key = body.dataset.motion;
  if (calMemo && calMemo.key !== key && !reducedMotion()) {
    body.style.transition = 'none';
    grid.style.transition = 'none';
    body.style.height = calMemo.height;
    grid.style.transform = `translateY(${calMemo.shift})`;
    body.getBoundingClientRect();
    body.style.transition = '';
    grid.style.transition = '';
    body.style.height = height;
    grid.style.transform = `translateY(${shift})`;
  }
  calMemo = { key, height, shift };
}

function bind() {
  const root = document.getElementById('app');
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.dataset?.field === 'rename') {
      event.preventDefault();
      commitRename();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSheet();
  });
  document.addEventListener('pointerdown', (event) => {
    const zone = event.target.closest?.('[data-swipe]');
    if (!zone) return;
    gesture = {
      x: event.clientX,
      y: event.clientY,
      onButton: Boolean(event.target.closest?.('button')),
    };
  });
  document.addEventListener('pointerup', (event) => {
    if (!gesture) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const onButton = gesture.onButton;
    gesture = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (onButton) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 350);
    }
    if (ui.tab !== 'calendar' || ui.sheet) return;
    if (ui.view === 'week') shiftWeek(dx < 0 ? 1 : -1);
    else {
      const next = shiftMonthIndex(ui.year, ui.month, dx < 0 ? 1 : -1);
      ui.year = next.y;
      ui.month = next.m;
      ui.view = 'month';
    }
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const today = todayISO();
    if (today === ui.today) return;
    ui.today = today;
    maybeBackfill(true);
    render();
  });
}

boot();
