export function productSpec(p) {
  if (!p) return '';
  const parts = [];
  const k = (p.unitKind || 'none').toLowerCase();
  if (k === 'volume' || k === 'mass' || k === 'length') {
    if (p.unitValue != null && p.unitSymbol) parts.push(`${p.unitValue} ${p.unitSymbol}`);
  } else if (k === 'size') {
    if (p.sizeLabel) parts.push(String(p.sizeLabel));
  } else if (k === 'shoe') {
    if (p.shoeSize) parts.push(String(p.shoeSize));
  }
  const attrs = Array.isArray(p.attributes) ? p.attributes : [];
  const attrStr = attrs.filter(a => a && a.key && a.value)
    .map(a => `${a.key}: ${a.value}`)
    .join(', ');
  if (attrStr) parts.push(attrStr);
  return parts.join(' • ');
}

export function appendNameWithSpec(name, p) {
  const spec = productSpec(p);
  if (spec) return `${name} [${spec}]`;
  return name;
}
