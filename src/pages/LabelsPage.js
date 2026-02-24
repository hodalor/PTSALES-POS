import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import EAN13Barcode from '../components/EAN13Barcode';

function LabelsPage() {
  const products = useSelector(s => s.products.products);
  const [query, setQuery] = useState('');
  const [copies, setCopies] = useState(1);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, query]);

  function printLabels() {
    const html = buildPrintHtml(filtered, copies);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Barcode Labels</h1>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="Search by name, SKU or barcode" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Copies</span>
            <input className="input" type="number" min="1" value={copies} onChange={e => setCopies(Math.max(1, Number(e.target.value)))} style={{ width: 100 }} />
          </label>
          <button className="btn btn-primary" onClick={printLabels}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="2"/><path d="M6 17h12v4H6z" stroke="currentColor" strokeWidth="2"/><path d="M4 9h16a2 2 0 012 2v2H2v-2a2 2 0 012-2z" stroke="currentColor" strokeWidth="2"/></svg>
            Print
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{ display: 'grid', gap: 6, alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>{p.sku}</div>
            <div style={{ display: 'grid', placeItems: 'center', padding: 4, background: '#ffffff' }}>
              {p.barcode ? <EAN13Barcode value={p.barcode} width={2} height={70} /> : <div style={{ color: '#ef4444' }}>No barcode</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPrintHtml(products, copies) {
  const items = [];
  products.forEach(p => {
    for (let i = 0; i < copies; i++) {
      items.push(p);
    }
  });
  const slots = items.map((p, idx) => `
    <div class="label">
      <div class="name">${escapeHtml(p.name || '')}</div>
      <div class="sku">${escapeHtml(p.sku || '')}</div>
      <div class="svg">${renderBarcodeSvg(p.barcode)}</div>
    </div>
  `).join('');
  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Labels</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .label { border: 1px dashed #cbd5e1; padding: 6mm 4mm; display: grid; align-items: center; }
        .name { font-size: 12pt; font-weight: 700; }
        .sku { font-size: 9pt; color: #64748b; margin-bottom: 2mm; }
        .svg { display: grid; place-items: center; }
        .svg svg { width: 100%; height: auto; }
        @media print {
          .label { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="grid">
        ${slots}
      </div>
    </body>
  </html>
  `;
  return html;
}

function renderBarcodeSvg(value) {
  const el = EAN13Barcode({ value, width: 2, height: 70, fontSize: 12, displayValue: true });
  if (!el) return '<div>No barcode</div>';
  const encoded = renderToStatic(el);
  return encoded;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function renderToStatic(reactElement) {
  if (!reactElement || reactElement.type !== 'svg') return '';
  const props = reactElement.props || {};
  const svgAttrs = Object.entries(props)
    .filter(([k]) => !['children'].includes(k))
    .map(([k, v]) => `${k}="${String(v)}"`).join(' ');
  const children = props.children || [];
  const renderChild = (child) => {
    if (!child) return '';
    if (typeof child === 'string') return child;
    const name = child.type;
    const p = child.props || {};
    const attrs = Object.entries(p).filter(([k]) => !['children'].includes(k)).map(([k, v]) => `${k}="${String(v)}"`).join(' ');
    const content = Array.isArray(p.children) ? p.children.map(renderChild).join('') : (p.children ? renderChild(p.children) : '');
    return `<${name} ${attrs}>${content}</${name}>`;
  };
  const inner = Array.isArray(children) ? children.map(renderChild).join('') : renderChild(children);
  return `<svg ${svgAttrs}>${inner}</svg>`;
}

export default LabelsPage;

