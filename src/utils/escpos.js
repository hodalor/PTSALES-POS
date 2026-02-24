// Very simple ESC/POS generator helpers (text only)
export function escposReceipt({ header, items, totals, footer }) {
  const lines = [];
  lines.push(center(header?.title || 'RECEIPT'));
  if (header?.store) lines.push(center(header.store));
  if (header?.branch) lines.push(center(`Branch: ${header.branch}`));
  lines.push('--------------------------------');
  items.forEach(it => {
    lines.push(text(`${truncate(it.name, 20)} x${it.qty}`));
    lines.push(right(`$${(it.price * it.qty).toFixed(2)}`));
  });
  lines.push('--------------------------------');
  lines.push(text(`Subtotal    $${totals.subtotal.toFixed(2)}`));
  lines.push(text(`Discount   -$${totals.discount.toFixed(2)}`));
  lines.push(text(`Tax         $${totals.tax.toFixed(2)}`));
  lines.push(text(`Total       $${totals.total.toFixed(2)}`));
  if (footer?.note) {
    lines.push('--------------------------------');
    lines.push(center(footer.note));
  }
  lines.push('\n\n\n');
  return lines.join('\n');
}

export function escposOpenDrawer() {
  // BEL or ESC p m t1 t2
  return '\x1B\x70\x00\x19\xFA';
}

export function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function center(s) { return s; }
function right(s) { return s; }
function text(s) { return s; }
function truncate(s, n) { return (s || '').length > n ? s.slice(0, n - 1) + '…' : s; }
