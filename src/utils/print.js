export function printReceiptHtml(html) {
  const w = window.open('', 'PRINT', 'width=400,height=600');
  if (!w) return;
  w.document.open();
  w.document.write(`
    <html>
    <head>
      <title>Receipt</title>
      <style>
        body { font-family: sans-serif; padding: 12px; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 0; }
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
  const logoSrc = '/logo512.png';
  const logo = `<div class="center"><img src="${logoSrc}" alt="logo" style="max-height:60px"/></div>`;
  const head = settings?.receiptHeader ? `<div class="center"><strong>${settings.receiptHeader}</strong></div>` : '';
  const foot = settings?.receiptFooter ? `<div class="center" style="margin-top:8px">${settings.receiptFooter}</div>` : '';
  return `
    ${logo}
    ${head}
    <div class="center"><h3>Receipt</h3></div>
    <div>Branch: ${sale.branchName || sale.branchId || '-'}</div>
    ${sale.sellerName ? `<div>Seller: ${sale.sellerName}</div>` : ''}
    <table>
      <tbody>
        ${sale.items.map(it => `<tr><td>${it.name} x${it.qty}</td><td style="text-align:right">$${(it.price*it.qty).toFixed(2)}</td></tr>`).join('')}
        <tr><td>Subtotal</td><td style="text-align:right">$${sale.subtotal.toFixed(2)}</td></tr>
        <tr><td>Discount</td><td style="text-align:right">-$${sale.discount.toFixed(2)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">$${sale.tax.toFixed(2)}</td></tr>
        <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>$${sale.total.toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
    ${foot}
  `;
}
