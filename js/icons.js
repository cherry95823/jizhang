/**
 * 细线图标。颜色跟文字走（currentColor），方便在玻璃卡片上保持同一套玫瑰棕。
 */

const PATHS = {
  utensils: '<path d="M8 3.5v6.2a1.6 1.6 0 0 1-1.6 1.6H6.2"/><path d="M8 3.5v17"/><path d="M5.2 3.5v4.2"/><path d="M10.8 3.5v4.2"/><path d="M16.2 3.5c1.7 2.3 2.3 4 2.3 6.4 0 1.6-1 2.6-2.3 2.6h-1.2V20.5"/>',
  cup: '<path d="M6 8.5h8.2v5.2a3.6 3.6 0 0 1-3.6 3.6H9.2A3.2 3.2 0 0 1 6 13.9V8.5z"/><path d="M14.2 9.6h1.6a2.2 2.2 0 0 1 0 4.4h-1.6"/><path d="M8 20.2h6.2"/>',
  transit: '<rect x="4.2" y="4.5" width="15.6" height="11.2" rx="2.2"/><path d="M4.2 10.2h15.6"/><path d="M8 15.7v2.2"/><path d="M16 15.7v2.2"/><path d="M7.4 18.6h2.2"/><path d="M14.4 18.6h2.2"/><circle cx="8" cy="13.1" r="0.7" fill="currentColor" stroke="none"/><circle cx="16" cy="13.1" r="0.7" fill="currentColor" stroke="none"/>',
  bag: '<path d="M6.2 8.2h11.6l-.7 11.2a1.5 1.5 0 0 1-1.5 1.4H8.4a1.5 1.5 0 0 1-1.5-1.4L6.2 8.2z"/><path d="M9 8.2V6.8A3 3 0 0 1 12 3.8 3 3 0 0 1 15 6.8v1.4"/>',
  daily: '<path d="M9 3.8h6l.4 2.2H8.6L9 3.8z"/><path d="M7.2 6h9.6l.8 13.2a1.4 1.4 0 0 1-1.4 1.5H7.8a1.4 1.4 0 0 1-1.4-1.5L7.2 6z"/><path d="M10 11.2h4"/>',
  beauty: '<path d="M9 3.8h3.2v6.2l2.2 2.4a3.6 3.6 0 1 1-7.2 0L9 10V3.8z"/><path d="M9 6.6h3.2"/><path d="M14.8 4.2c1.4.6 2.2 1.6 2.2 3.2"/>',
  fun: '<path d="M5 8.2h10.2a2 2 0 0 1 2 2v1.2l2.4 1.1a.8.8 0 0 1 0 1.5l-2.4 1.1v1.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"/><path d="M9.2 11.2v3.2"/>',
  study: '<path d="M4.5 7.2 12 4.2l7.5 3-7.5 3-7.5-3z"/><path d="M7.2 9.1v5.2c1.6 1.3 3.2 1.9 4.8 1.9s3.2-.6 4.8-1.9V9.1"/><path d="M19.2 8.1v6.4"/>',
  med: '<circle cx="12" cy="12" r="7.2"/><path d="M12 8.6v6.8"/><path d="M8.6 12h6.8"/>',
  phone: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.6h2"/>',
  home: '<path d="M4.5 11.2 12 4.8l7.5 6.4"/><path d="M7 10.4V19.2h10V10.4"/><path d="M10.4 19.2v-4.6h3.2v4.6"/>',
  gift: '<rect x="4.5" y="10" width="15" height="9" rx="1.4"/><path d="M4.5 13.4h15"/><path d="M12 10v9"/><path d="M12 10c-1.2-2.6-4.6-2.8-4.6-.6 0 1.6 2.2 2.4 4.6.6z"/><path d="M12 10c1.2-2.6 4.6-2.8 4.6-.6 0 1.6-2.2 2.4-4.6.6z"/>',
  travel: '<path d="M4 16.5 20 8.2"/><path d="M14.2 7.2 16.8 4.6c.4-.4 1-.2 1.1.4l.6 3.2 3.2.6c.6.1.8.7.4 1.1l-2.6 2.6"/><path d="M8.6 14.2 5.2 17.6c-.5.5-.2 1.3.5 1.3H9l1.2-2.2"/>',
  other: '<circle cx="6.5" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
  wallet: '<rect x="3.8" y="6.2" width="16.4" height="12" rx="2"/><path d="M3.8 10h16.4"/><circle cx="15.6" cy="13.6" r="0.8" fill="currentColor" stroke="none"/>',
  award: '<circle cx="12" cy="9" r="4.2"/><path d="M9.2 12.6 8 20l4-2.1L16 20l-1.2-7.4"/>',
  grant: '<path d="M12 20.2V10"/><path d="M12 14.2c-2.4-1-4.6-1-6.4.2 1.2-3.6 3.4-5.4 6.4-6.4 3 1 5.2 2.8 6.4 6.4-1.8-1.2-4-.2-6.4-.2z"/><path d="M8.5 20.2h7"/>',
  brief: '<rect x="4" y="8" width="16" height="11" rx="1.6"/><path d="M9 8V6.4A1.4 1.4 0 0 1 10.4 5h3.2A1.4 1.4 0 0 1 15 6.4V8"/><path d="M4 12.5h16"/>',
  red: '<path d="M5 8.2h14v10.2a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 18.4V8.2z"/><path d="M5 8.2 12 13.2 19 8.2"/><path d="M12 8.2V5.6"/>',
  refund: '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4.8v4.2h-4.2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16"/><path d="M8 3.8v3"/><path d="M16 3.8v3"/>',
  board: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>',
  sliders: '<path d="M5 8h14"/><path d="M5 16h14"/><circle cx="9" cy="8" r="1.7" fill="none"/><circle cx="15" cy="16" r="1.7" fill="none"/>',
  back: '<path d="M14.5 6.5 9 12l5.5 5.5"/>',
  chevron: '<path d="M9 6.5 14.5 12 9 17.5"/>',
  close: '<path d="M7 7l10 10"/><path d="M17 7 7 17"/>',
  plus: '<path d="M12 6.5v11"/><path d="M6.5 12h11"/>',
  backspace: '<path d="M8.2 7.2h9.2a1.4 1.4 0 0 1 1.4 1.4v7.8a1.4 1.4 0 0 1-1.4 1.4H8.2L4.2 12l4-4.8z"/><path d="M11 10.2l3.6 3.6"/><path d="M14.6 10.2 11 13.8"/>',
};

export function icon(name) {
  const body = PATHS[name] || PATHS.other;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
