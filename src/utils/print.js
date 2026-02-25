import { formatCurrency } from './currency';
import { generateQrSvg } from './qr';

export function printReceiptHtml(html) {
  const w = window.open('', 'PRINT', 'width=400,height=600');
  if (!w) return;
  w.document.open();
  w.document.write(`
    <html>
    <head>
      <title>Receipt</title>
      <style>
        body { font-family: monospace; padding: 12px; color:#111; }
        .center { text-align: center; }
        .muted { color:#64748b; }
        .sp { display:flex; justify-content:space-between; }
        .hr { border-top:1px dashed #d1d5db; margin:8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .right { text-align:right; }
        .title { font-weight:700; }
        .small { font-size: 12px; }
        .qr svg { width: 160px; height: 160px; }
        @media print {
          img, svg { max-width: none; }
        }
      </style>
    </head>
    <body>
      ${html}
      <script>
        (function() {
          function doPrint() {
            try { window.focus(); } catch(e) {}
            try { window.print(); } catch(e) {}
          }
          if (document.readyState === 'complete') {
            setTimeout(doPrint, 300);
          } else {
            window.addEventListener('load', function() { setTimeout(doPrint, 300); });
          }
          window.addEventListener('afterprint', function() { setTimeout(function(){ window.close(); }, 200); });
        })();
      </script>
    </body></html>
  `);
  w.document.close();
}

export function buildBrandedReceiptHtml({ settings, sale }) {
  const logoSrc = settings?.receiptLogoUrl || '/logo512.png';
  const branch = sale.branchName || sale.branchId || '-';
  const phone = settings?.businessPhone || '';
  const website = settings?.businessWebsite || '';
  const cashier = sale.sellerName || '—';
  const qtySum = (sale.items || []).reduce((s, it) => s + (Number(it.qty)||0), 0);
  const paid = (sale.payment_methods || []).reduce((s, p) => s + (Number(p.amount)||0), 0);
  const change = Math.max(0, paid - (Number(sale.total)||0));
  const rate = (() => {
    if (Number(sale.subtotal) - Number(sale.discount) > 0) {
      const r = Number(sale.tax || 0) / Math.max(1e-6, Number(sale.subtotal) - Number(sale.discount));
      return Math.round(r * 10000) / 100;
    }
    return Math.round((Number(settings?.taxRate || 0) * 10000)) / 100;
  })();
  const taxableVal = Math.max(0, Number(sale.subtotal) - Number(sale.discount));
  const vatVal = Number(sale.tax) || 0;
  const head = settings?.receiptHeader ? `<div class="center small">${settings.receiptHeader}</div>` : '';
  const foot = (settings?.receiptFooter || website) ? `<div class="center small" style="margin-top:8px">${[website, settings?.receiptFooter].filter(Boolean).join(' • ')}</div>` : '';
  const payments = (sale.payment_methods || []).map(p => {
    const label = String(p.type || 'cash').toUpperCase();
    return `<div class="sp"><span>${label}</span><span>${formatCurrency(p.amount || 0, settings)}</span></div>`;
  }).join('');
  const base = (settings?.receiptQrBaseUrl && settings.receiptQrBaseUrl.trim()) ? settings.receiptQrBaseUrl.trim().replace(/\/+$/,'') : (typeof window !== 'undefined' ? window.location.origin : '');
  const saleId = sale?.id || sale?._id || '';
  const compact = {
    id: saleId,
    ts: sale.created_at,
    br: branch,
    ca: cashier,
    inv: sale.invoiceSerial || '',
    items: (sale.items || []).map(i => [i.name, i.qty, i.price]),
    t: [sale.subtotal, sale.discount, sale.tax, sale.total],
    pay: (sale.payment_methods || []).map(p => ({ type: p.type, amount: p.amount }))
  };
  let encoded = '';
  try { encoded = btoa(unescape(encodeURIComponent(JSON.stringify(compact)))); } catch(e) {}
  let shareUrl = saleId ? `${base}/r/${encodeURIComponent(String(saleId))}` : '';
  if (saleId && encoded && (shareUrl.length + encoded.length + 3) <= 150) {
    shareUrl = `${shareUrl}?d=${encoded}`;
  }
  const qrSvgStr = shareUrl ? generateQrSvg(shareUrl, 160) : '';
  return `
    <div class="center"><img src="${logoSrc}" alt="logo" style="max-height:60px"/></div>
    ${head}
    <div class="center title">${branch}</div>
    ${phone ? `<div class="center small">${phone}</div>` : ''}
    <div class="small">CASHIER: ${cashier}</div>
    <div class="hr"></div>
    <table>
      <tbody>
        ${sale.items.map(it => `
          <tr>
            <td>${it.name}${it.spec ? ` [${it.spec}]` : ''} ${it.qty ? `x${it.qty}` : ''}</td>
            <td class="right">${formatCurrency((Number(it.price)||0) * (Number(it.qty)||1), settings)}</td>
          </tr>`).join('')}
        <tr><td class="muted">Subtotal</td><td class="right">${formatCurrency(sale.subtotal || 0, settings)}</td></tr>
        <tr><td class="muted">Discount</td><td class="right">-${formatCurrency(sale.discount || 0, settings)}</td></tr>
        <tr><td class="muted">Tax</td><td class="right">${formatCurrency(sale.tax || 0, settings)}</td></tr>
        <tr><td class="title">DUE (VAT INCL)</td><td class="right title">${formatCurrency(sale.total || 0, settings)}</td></tr>
      </tbody>
    </table>
    <div class="hr"></div>
    <div class="title">TENDER</div>
    ${payments}
    <div class="sp"><span>ROUNDING</span><span>${formatCurrency(0, settings)}</span></div>
    <div class="sp"><span>CHANGE</span><span>${formatCurrency(change, settings)}</span></div>
    <div class="sp"><span class="muted">TOTAL ITEMS:</span><span class="muted">${qtySum}</span></div>
    <div class="hr"></div>
    <div class="title">TAX INVOICE</div>
    <div class="sp"><span>VAT INCL @${rate}%</span><span></span></div>
    <div class="sp"><span class="muted">TAXABLE VAL</span><span>${formatCurrency(taxableVal, settings)}</span></div>
    <div class="sp"><span class="muted">VAT VAL</span><span>${formatCurrency(vatVal, settings)}</span></div>
    ${settings?.businessTpin ? `<div class="sp"><span class="muted">TPIN</span><span>${settings.businessTpin}</span></div>` : ''}
    ${settings?.sdcId ? `<div class="sp"><span class="muted">SDC ID</span><span>${settings.sdcId}</span></div>` : ''}
    ${sale?.receiptNumber ? `<div class="sp"><span class="muted">RECEIPT</span><span>${sale.receiptNumber}</span></div>` : ''}
    ${sale?.invoiceSerial ? `<div class="sp"><span class="muted">INVOICE</span><span>${sale.invoiceSerial}</span></div>` : ''}
    <div class="hr"></div>
    ${shareUrl ? `<div class="center small">Scan to view online</div>` : ''}
    ${shareUrl ? `<div class="center qr" style="margin:6px 0">${qrSvgStr}</div>` : ''}
    ${shareUrl ? `<div class="center small" style="word-break: break-all">${shareUrl}</div>` : ''}
    ${foot}
  `;
}
