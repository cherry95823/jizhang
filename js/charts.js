/**
 * 手写的细线图表。颜色保持低饱和，和玻璃底融在一起，不使用粗色块。
 */

export const CHART_COLORS = [
  '#C98996',
  '#7E9A84',
  '#C4A57A',
  '#C7A3B0',
  '#8EAAA4',
  '#D0AA9A',
  '#B3A0C4',
  '#C48B96',
  '#9AA7B0',
  '#CDB59A',
  '#D09A9A',
  '#8EA396',
  '#E0C4BA',
  '#B8929A',
];

function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

export function donutSVG(slices, centerLabel) {
  const size = 168;
  const cx = 84;
  const cy = 84;
  const r = 58;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const gap = slices.length > 1 ? 1.8 : 0;
  let offset = 0;
  const arcs = slices.map((slice) => {
    const full = total === 0 ? 0 : (slice.value / total) * c;
    const len = Math.max(0, full - gap);
    const dash = `${len} ${c - len}`;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${slice.color}" stroke-width="11" stroke-linecap="butt" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" />`;
    offset += full;
    return circle;
  }).join('');
  const label = esc(centerLabel || '');
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="支出分类环形图">
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="11" />
      ${arcs}
    </g>
    <text x="${cx}" y="80" text-anchor="middle" class="donut-total">${label}</text>
    <text x="${cx}" y="98" text-anchor="middle" class="donut-caption">支出</text>
  </svg>`;
}

export function barsSVG(days) {
  const width = 320;
  const height = 132;
  const padL = 4;
  const padR = 4;
  const base = 104;
  const max = Math.max(1, ...days.map((day) => Math.max(day.income, day.expense)));
  const n = Math.max(days.length, 1);
  const slot = (width - padL - padR) / n;
  const barW = Math.max(1.5, Math.min(5, slot * 0.28));
  const labelStep = n > 16 ? 5 : n > 10 ? 2 : 1;
  const bars = days.map((day, index) => {
    const x = padL + slot * index + slot / 2;
    const hIn = (day.income / max) * 78;
    const hOut = (day.expense / max) * 78;
    const income = day.income > 0
      ? `<rect x="${(x - barW - 0.8).toFixed(2)}" y="${(base - hIn).toFixed(2)}" width="${barW}" height="${hIn.toFixed(2)}" rx="1.2" fill="#7E9A84" opacity="0.85" />`
      : '';
    const expense = day.expense > 0
      ? `<rect x="${(x + 0.8).toFixed(2)}" y="${(base - hOut).toFixed(2)}" width="${barW}" height="${hOut.toFixed(2)}" rx="1.2" fill="#C98996" opacity="0.9" />`
      : '';
    const dayNum = Number(day.date.slice(-2));
    const label = index % labelStep === 0
      ? `<text x="${x.toFixed(2)}" y="122" text-anchor="middle" class="bar-label">${dayNum}</text>`
      : '';
    return income + expense + label;
  }).join('');
  return `<svg class="bars" viewBox="0 0 ${width} ${height}" role="img" aria-label="每日收入与支出">
    <line x1="0" y1="${base}" x2="${width}" y2="${base}" stroke="rgba(92,74,79,0.18)" stroke-width="0.6" />
    ${bars}
  </svg>`;
}
