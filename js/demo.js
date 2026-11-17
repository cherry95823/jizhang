/**
 * 示例数据只在设置里手动载入，平时打开是空账本。
 * 日期相对「今天」计算，这样截图和日常试用都会落在当前这个月。
 */

import {
  addDays,
  applyGrantBackfill,
  completeOnboarding,
  formatISODate,
  freshState,
  parseISODate,
  shiftMonth,
} from './ledger.js';

function stamp(partial) {
  return {
    note: '',
    auto: false,
    createdAt: `${partial.date}T08:00:00.000Z`,
    updatedAt: `${partial.date}T08:00:00.000Z`,
    ...partial,
  };
}

export function buildDemoState(today) {
  const now = parseISODate(today);
  const start = shiftMonth(now.y, now.m, -2);
  const setupDate = formatISODate(start.y, start.m, 1);
  const monthStart = formatISODate(now.y, now.m, 1);
  const day = (offset) => addDays(today, offset);

  let state = completeOnboarding(freshState(), setupDate, {
    living: 300,
    scholarship: 0,
    grant: 0,
    savings: 800,
  });

  state.records = [
    stamp({ id: 'demo-living-in', type: 'income', amount: 2000, walletId: 'living', categoryId: 'income-living', note: '本月生活费', date: monthStart === today ? day(-20) : monthStart }),
    stamp({ id: 'demo-job', type: 'income', amount: 360, walletId: 'living', categoryId: 'income-part', note: '周末家教', date: today, createdAt: `${today}T16:00:00.000Z`, updatedAt: `${today}T16:00:00.000Z` }),
    stamp({ id: 'demo-refund', type: 'income', amount: 45, walletId: 'living', categoryId: 'income-refund', note: '退运费', date: day(-2) }),
    stamp({ id: 'demo-food', type: 'expense', amount: 28.5, walletId: 'living', categoryId: 'food', note: '食堂午餐', date: today, createdAt: `${today}T12:10:00.000Z`, updatedAt: `${today}T12:10:00.000Z` }),
    stamp({ id: 'demo-transit', type: 'expense', amount: 4, walletId: 'living', categoryId: 'transit', note: '地铁', date: today, createdAt: `${today}T12:40:00.000Z`, updatedAt: `${today}T12:40:00.000Z` }),
    stamp({ id: 'demo-snack', type: 'expense', amount: 16, walletId: 'living', categoryId: 'snack', note: '燕麦拿铁', date: day(-1) }),
    stamp({ id: 'demo-shop', type: 'expense', amount: 129, walletId: 'living', categoryId: 'shop', note: '耳机', date: day(-1) }),
    stamp({ id: 'demo-phone', type: 'expense', amount: 39, walletId: 'living', categoryId: 'phone', note: '话费', date: day(-2) }),
    stamp({ id: 'demo-study', type: 'expense', amount: 42, walletId: 'living', categoryId: 'study', note: '打印讲义', date: day(-3) }),
    stamp({ id: 'demo-fun', type: 'expense', amount: 68, walletId: 'living', categoryId: 'fun', note: '电影', date: day(-4) }),
    stamp({ id: 'demo-gift', type: 'expense', amount: 99, walletId: 'living', categoryId: 'gift', note: '朋友生日', date: day(-5) }),
    stamp({ id: 'demo-daily', type: 'expense', amount: 23.5, walletId: 'living', categoryId: 'daily', note: '洗衣液', date: day(-6) }),
    stamp({ id: 'demo-beauty', type: 'expense', amount: 156, walletId: 'living', categoryId: 'beauty', note: '口红', date: day(-9) }),
    stamp({ id: 'demo-med', type: 'expense', amount: 37, walletId: 'living', categoryId: 'med', note: '感冒药', date: day(-11) }),
    stamp({ id: 'demo-home', type: 'expense', amount: 80, walletId: 'living', categoryId: 'home', note: '宿舍电费', date: day(-12) }),
    stamp({ id: 'demo-travel', type: 'expense', amount: 186, walletId: 'living', categoryId: 'travel', note: '周末高铁', date: day(-15) }),
    stamp({ id: 'demo-other', type: 'expense', amount: 12, walletId: 'living', categoryId: 'exp-other', note: '杂项', date: day(-7) }),
    stamp({
      id: 'demo-sch',
      type: 'income',
      amount: 3000,
      walletId: 'scholarship',
      categoryId: 'income-scholarship',
      note: '学年奖学金',
      date: today >= formatISODate(now.y, now.m, 3) ? formatISODate(now.y, now.m, 3) : today,
    }),
    stamp({ id: 'demo-save-in', type: 'income', amount: 500, walletId: 'savings', categoryId: 'income-red', note: '生日红包', date: day(-10) }),
    stamp({ id: 'demo-save-out', type: 'expense', amount: 120, walletId: 'savings', categoryId: 'gift', note: '回礼', date: day(-5) }),
  ];

  return applyGrantBackfill(state, today).state;
}
