import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRANT_AMOUNT,
  addDays,
  applyGrantBackfill,
  applyKey,
  cents,
  completeOnboarding,
  deleteCategory,
  deleteRecord,
  eachDate,
  expenseByCategory,
  formatMoney,
  freshState,
  grantMonthsDue,
  monthMatrix,
  normalizeState,
  parseBackup,
  renameCategory,
  runningLedger,
  setStartBalances,
  startOfWeek,
  summarize,
  upsertRecord,
  walletBalance,
  weekday,
} from '../js/ledger.js';

function opened(setupDate, balances = {}) {
  return completeOnboarding(freshState(), setupDate, {
    living: 0,
    scholarship: 0,
    grant: 0,
    savings: 0,
    ...balances,
  });
}

function add(state, draft) {
  const result = upsertRecord(state, draft, '2026-11-17T00:00:00.000Z');
  assert.equal(result.errors.length, 0);
  return result.state;
}

test('cents rounds half away from zero at the cent', () => {
  assert.equal(cents(0.1 + 0.2), 0.3);
  assert.equal(cents(1.005), 1.01);
  assert.equal(cents('12.345'), 12.35);
  assert.equal(cents('nope'), 0);
});

test('money format uses yuan and a unicode minus', () => {
  assert.equal(formatMoney(1280), '¥1,280.00');
  assert.equal(formatMoney(-32.5), '−¥32.50');
});

test('November 2026 calendar starts on Monday', () => {
  assert.equal(weekday('2026-11-17'), 2);
  assert.equal(weekday('2026-11-01'), 0);
  assert.equal(startOfWeek('2026-11-17'), '2026-11-16');
  assert.equal(startOfWeek('2026-11-01'), '2026-10-26');
  const weeks = monthMatrix(2026, 11);
  assert.equal(weeks.length, 6);
  assert.deepEqual(weeks[0], [
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
  ]);
  assert.equal(weeks[3][1], '2026-11-17');
  assert.equal(weeks[5][6], '2026-12-06');
});

test('wallet balance is opening balance plus income minus expense', () => {
  let state = opened('2026-11-01', { living: 300 });
  state = add(state, {
    id: 'in', type: 'income', amount: '2000', walletId: 'living', categoryId: 'income-living', note: '', date: '2026-11-01',
  });
  state = add(state, {
    id: 'a', type: 'expense', amount: '0.1', walletId: 'living', categoryId: 'food', note: '', date: '2026-11-02',
  });
  state = add(state, {
    id: 'b', type: 'expense', amount: '0.2', walletId: 'living', categoryId: 'food', note: '', date: '2026-11-03',
  });
  state = add(state, {
    id: 'other', type: 'expense', amount: '50', walletId: 'savings', categoryId: 'gift', note: '', date: '2026-11-03',
  });
  assert.equal(walletBalance(state, 'living'), 2299.7);
  assert.equal(walletBalance(state, 'living', '2026-11-02'), 2299.9);
  assert.equal(walletBalance(state, 'savings'), -50);
});

test('changing the opening balance changes the current balance', () => {
  let state = opened('2026-11-01', { scholarship: 100 });
  state = add(state, {
    id: 's', type: 'income', amount: '3000', walletId: 'scholarship', categoryId: 'income-scholarship', note: '', date: '2026-11-02',
  });
  state = setStartBalances(state, { scholarship: 250 });
  assert.equal(walletBalance(state, 'scholarship'), 3250);
  assert.equal(walletBalance(state, 'living'), 0);
});

test('day and month totals ignore other days', () => {
  let state = opened('2026-10-01');
  state = add(state, {
    id: 'd1', type: 'income', amount: '500', walletId: 'living', categoryId: 'income-living', note: '', date: '2026-11-17',
  });
  state = add(state, {
    id: 'd2', type: 'expense', amount: '28.5', walletId: 'living', categoryId: 'food', note: '午饭', date: '2026-11-17',
  });
  state = add(state, {
    id: 'd3', type: 'expense', amount: '4', walletId: 'living', categoryId: 'transit', note: '', date: '2026-11-17',
  });
  state = add(state, {
    id: 'd4', type: 'expense', amount: '80', walletId: 'living', categoryId: 'home', note: '', date: '2026-10-31',
  });
  const day = summarize(state, ['2026-11-17']);
  assert.equal(day.income, 500);
  assert.equal(day.expense, 32.5);
  assert.equal(day.net, 467.5);
  const november = summarize(state, eachDate('2026-11-01', '2026-11-30'), 'living');
  assert.equal(november.income, 500);
  assert.equal(november.expense, 32.5);
  assert.equal(november.net, 467.5);
});

test('continuous range includes the days between, multi-select does not', () => {
  let state = opened('2026-11-01');
  for (const [id, date, amount] of [
    ['a', '2026-11-01', '10'],
    ['b', '2026-11-02', '20'],
    ['c', '2026-11-03', '30'],
  ]) {
    state = add(state, {
      id, type: 'expense', amount, walletId: 'living', categoryId: 'food', note: '', date,
    });
  }
  state = add(state, {
    id: 'in', type: 'income', amount: '100', walletId: 'scholarship', categoryId: 'income-scholarship', note: '', date: '2026-11-02',
  });
  const span = summarize(state, eachDate('2026-11-03', '2026-11-01'));
  assert.equal(span.expense, 60);
  assert.equal(span.income, 100);
  assert.equal(span.net, 40);
  assert.equal(span.byDate.length, 3);
  assert.equal(span.byCategory.find((c) => c.categoryId === 'food').expense, 60);
  assert.equal(span.byWallet.find((w) => w.walletId === 'scholarship').income, 100);

  const multi = summarize(state, ['2026-11-01', '2026-11-03', '2026-11-01']);
  assert.equal(multi.expense, 40);
  assert.equal(multi.income, 0);
  assert.equal(multi.byDate.map((d) => d.date).join(','), '2026-11-01,2026-11-03');
});

test('empty selection sums to zero and still lists the days', () => {
  const state = opened('2026-11-01');
  const sum = summarize(state, ['2026-11-17']);
  assert.deepEqual(
    { income: sum.income, expense: sum.expense, net: sum.net },
    { income: 0, expense: 0, net: 0 },
  );
  assert.equal(sum.byDate.length, 1);
  assert.equal(summarize(state, []).byDate.length, 0);
});

test('生活费 category totals only count that wallet’s expenses', () => {
  let state = opened('2026-11-01');
  state = add(state, {
    id: 'f', type: 'expense', amount: '28.5', walletId: 'living', categoryId: 'food', note: '', date: '2026-11-17',
  });
  state = add(state, {
    id: 'f2', type: 'expense', amount: '11.5', walletId: 'living', categoryId: 'food', note: '', date: '2026-11-16',
  });
  state = add(state, {
    id: 't', type: 'expense', amount: '4', walletId: 'living', categoryId: 'transit', note: '', date: '2026-11-17',
  });
  state = add(state, {
    id: 'skip', type: 'expense', amount: '99', walletId: 'savings', categoryId: 'food', note: '', date: '2026-11-17',
  });
  state = add(state, {
    id: 'inc', type: 'income', amount: '2000', walletId: 'living', categoryId: 'income-living', note: '', date: '2026-11-01',
  });
  const rows = expenseByCategory(state, 'living');
  assert.deepEqual(rows, [
    { categoryId: 'food', amount: 40 },
    { categoryId: 'transit', amount: 4 },
  ]);
  const month = expenseByCategory(state, 'living', ['2026-11-17']);
  assert.equal(month.find((r) => r.categoryId === 'food').amount, 28.5);
});

test('running balance follows date order, not insertion order', () => {
  let state = opened('2026-11-01', { savings: 800 });
  state = add(state, {
    id: 'later', type: 'expense', amount: '120', walletId: 'savings', categoryId: 'gift', note: '', date: '2026-11-12',
  });
  state = add(state, {
    id: 'earlier', type: 'income', amount: '500', walletId: 'savings', categoryId: 'income-red', note: '', date: '2026-11-07',
  });
  const rows = runningLedger(state, 'savings');
  assert.deepEqual(rows.map((row) => [row.record.id, row.balance]), [
    ['earlier', 1300],
    ['later', 1180],
  ]);
});

test('grant backfill credits the 10th on or after setup, once', () => {
  const early = applyGrantBackfill(opened('2026-11-05'), '2026-11-20');
  assert.equal(early.added.length, 1);
  assert.equal(early.added[0].date, '2026-11-10');
  assert.equal(early.added[0].amount, GRANT_AMOUNT);
  assert.equal(early.added[0].walletId, 'grant');
  assert.equal(early.added[0].auto, true);
  assert.equal(walletBalance(early.state, 'grant'), 500);

  const lateSetup = applyGrantBackfill(opened('2026-11-15'), '2026-11-20');
  assert.equal(lateSetup.added.length, 0);

  const beforeTenth = applyGrantBackfill(opened('2026-11-05'), '2026-11-09');
  assert.equal(beforeTenth.added.length, 0);

  const again = applyGrantBackfill(early.state, '2026-11-20');
  assert.equal(again.added.length, 0);
  assert.equal(again.state.records.length, 1);
});

test('grant backfill catches missed months across a year boundary and skips a future 10th', () => {
  const { state, added } = applyGrantBackfill(opened('2025-11-20'), '2026-02-09');
  assert.deepEqual(added.map((r) => r.date), ['2025-12-10', '2026-01-10']);
  assert.equal(walletBalance(state, 'grant'), 1000);
  assert.deepEqual(grantMonthsDue('2025-12-10', '2026-01-10'), ['2025-12', '2026-01']);
});

test('deleting an automatic grant does not recreate it', () => {
  const first = applyGrantBackfill(opened('2026-09-01'), '2026-11-17');
  assert.deepEqual(first.added.map((r) => r.date), ['2026-09-10', '2026-10-10', '2026-11-10']);
  const removed = deleteRecord(first.state, 'auto-grant-2026-10');
  assert.equal(removed.records.some((r) => r.id === 'auto-grant-2026-10'), false);
  const second = applyGrantBackfill(removed, '2026-11-17');
  assert.equal(second.added.length, 0);
  assert.equal(second.state.records.length, 2);
});

test('an existing automatic record is not duplicated, and an edited amount is kept', () => {
  let state = opened('2026-11-01');
  state.records = [{
    id: 'auto-grant-2026-11',
    type: 'income',
    amount: 100,
    walletId: 'grant',
    categoryId: 'income-grant',
    note: '改过',
    date: '2026-11-10',
    auto: true,
    createdAt: '2026-11-10T02:00:00.000Z',
    updatedAt: '2026-11-10T02:00:00.000Z',
  }];
  state.grantCreditedMonths = [];
  const filled = applyGrantBackfill(state, '2026-11-17');
  assert.equal(filled.added.length, 0);
  assert.equal(filled.state.records.length, 1);
  assert.equal(filled.state.records[0].amount, 100);
  assert.ok(filled.state.grantCreditedMonths.includes('2026-11'));
});

test('editing a record keeps the automatic flag and replaces the amount', () => {
  let state = applyGrantBackfill(opened('2026-11-01'), '2026-11-17').state;
  const result = upsertRecord(state, {
    id: 'auto-grant-2026-11',
    type: 'income',
    amount: '480',
    walletId: 'grant',
    categoryId: 'income-grant',
    note: '少发了一点',
    date: '2026-11-12',
    auto: false,
  }, '2026-11-17T03:00:00.000Z');
  assert.equal(result.record.auto, true);
  assert.equal(result.record.amount, 480);
  assert.equal(result.record.date, '2026-11-12');
  assert.equal(walletBalance(result.state, 'grant'), 480);
});

test('draft validation requires amount, category, and wallet', () => {
  const state = opened('2026-11-01');
  const bad = upsertRecord(state, {
    type: 'expense', amount: '', walletId: '', categoryId: 'income-living', note: '', date: '2026-11-17',
  }, '2026-11-17T00:00:00.000Z');
  assert.deepEqual(bad.errors, ['请输入金额', '请选择钱包', '请选择分类']);
  assert.equal(bad.state.records.length, 0);
});

test('keypad keeps two decimals and a single dot', () => {
  assert.equal(applyKey('', '0'), '0');
  assert.equal(applyKey('0', '2'), '2');
  assert.equal(applyKey('12', '.'), '12.');
  assert.equal(applyKey('12.', '.'), '12.');
  assert.equal(applyKey('12.', '5'), '12.5');
  assert.equal(applyKey('12.50', '9'), '12.50');
  assert.equal(applyKey('12.5', 'back'), '12.');
  assert.equal(applyKey('', '.'), '0.');
});

test('categories can be renamed; custom ones delete only when unused', () => {
  let state = opened('2026-11-01');
  const added = { ...state, categories: state.categories.concat({ id: 'cat-tea', name: '奶茶', type: 'expense', icon: 'other', builtin: false }) };
  assert.equal(renameCategory(added, 'food', '  正餐  ').state.categories.find((c) => c.id === 'food').name, '正餐');
  assert.equal(deleteCategory(added, 'food').error, '默认分类可以改名，不能删除');
  state = add(added, {
    id: 'tea', type: 'expense', amount: '15', walletId: 'living', categoryId: 'cat-tea', note: '', date: '2026-11-02',
  });
  assert.match(deleteCategory(state, 'cat-tea').error, /只能改名/);
  const removed = deleteRecord(state, 'tea');
  assert.equal(deleteCategory(removed, 'cat-tea').error, '');
  assert.equal(deleteCategory(removed, 'cat-tea').state.categories.some((c) => c.id === 'cat-tea'), false);
});

test('normalize keeps custom categories and drops broken records', () => {
  const state = normalizeState({
    onboarded: true,
    setupDate: '2026-11-01',
    wallets: [{ id: 'living', startBalance: 12.345 }],
    categories: [
      { id: 'food', name: '早饭' },
      { id: 'cat-x', name: '宠物', type: 'expense', icon: 'other' },
    ],
    records: [
      { id: 'ok', type: 'expense', amount: 8, walletId: 'living', categoryId: 'food', date: '2026-11-02', note: '粥' },
      { id: 'bad-day', type: 'expense', amount: 8, walletId: 'living', categoryId: 'food', date: '2026-02-31' },
      { id: 'bad-wallet', type: 'expense', amount: 8, walletId: 'nope', categoryId: 'food', date: '2026-11-02' },
    ],
    grantCreditedMonths: ['2026-10'],
  });
  assert.equal(state.onboarded, true);
  assert.equal(state.wallets.find((w) => w.id === 'living').startBalance, 12.35);
  assert.equal(state.categories.find((c) => c.id === 'food').name, '早饭');
  assert.ok(state.categories.some((c) => c.id === 'cat-x' && c.builtin === false));
  assert.deepEqual(state.records.map((r) => r.id), ['ok']);
  assert.deepEqual(state.grantCreditedMonths, ['2026-10']);
});

test('backup parser rejects files that are not a ledger', () => {
  assert.throws(() => parseBackup('{', '2026-11-17'), /备份/);
  assert.throws(() => parseBackup('{"records":[]}', '2026-11-17'), /备份/);
  const state = parseBackup(JSON.stringify({
    records: [],
    wallets: [],
    setupDate: '2026-08-01',
    onboarded: true,
  }), '2026-11-17');
  assert.equal(state.setupDate, '2026-08-01');
  assert.equal(state.wallets.length, 4);
});

test('eachDate is inclusive and walks backwards ranges', () => {
  assert.deepEqual(eachDate('2026-11-17', '2026-11-19'), ['2026-11-17', '2026-11-18', '2026-11-19']);
  assert.equal(eachDate('2026-11-19', '2026-11-17').length, 3);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
