import { Router } from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import Settings from '../models/Settings.js';
import Branch from '../models/Branch.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import mongoose from 'mongoose';

const r = Router();

r.use(requireAuth);

function productLookupQuery(productId) {
  const pid = String(productId || '');
  const or = [{ id: pid }];
  if (mongoose.isValidObjectId(pid)) or.unshift({ _id: pid });
  return { $or: or };
}

function getBranchQty(mapLike, branchId) {
  if (!mapLike) return 0;
  if (typeof mapLike.get === 'function') return Number(mapLike.get(branchId) || 0);
  return Number(mapLike[branchId] || 0);
}
function setBranchQty(mapLike, branchId, qty) {
  if (!mapLike) return;
  if (typeof mapLike.set === 'function') {
    mapLike.set(branchId, qty);
  } else {
    mapLike[branchId] = qty;
  }
}

r.get('/', async (req, res) => {
  const rows = await Sale.find().sort({ created_at: -1 }).limit(500);
  res.json(rows);
});

r.post('/', requireRoleOrPerm(['Admin','Manager','Cashier'], 'add_sales'), async (req, res) => {
  const payload = req.body || {};
  const branchId = String(payload.branchId || '');
  if (!branchId) return res.status(400).json({ error: 'Missing branchId' });
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Sale must include items' });
  const cleaned = items.map(it => ({
    productId: it.productId,
    variantId: it.variantId || null,
    qty: Math.abs(Number(it.qty) || 0),
    sku: it.sku || '',
    name: it.name || ''
  }));
  if (cleaned.some(it => !it.productId || !Number.isFinite(it.qty) || it.qty <= 0)) {
    return res.status(400).json({ error: 'Each item must include productId and positive qty' });
  }

  let branchCode = branchId;
  try {
    const b = await Branch.findOne({ id: branchId });
    if (b?.code) branchCode = b.code;
  } catch {}

  let invoiceNum = 1;
  let receiptNum = 1;
  let invoicePrefix = 'INV';
  let receiptPrefix = 'RCPT';
  try {
    const updated = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $inc: { 'data.nextInvoiceNumber': 1, 'data.nextReceiptNumber': 1 } },
      { new: true, upsert: true }
    );
    const data = updated?.data || {};
    invoicePrefix = String(data.invoicePrefix || 'INV');
    receiptPrefix = String(data.receiptPrefix || 'RCPT');
    invoiceNum = Math.max(1, Number(data.nextInvoiceNumber || 1) - 1);
    receiptNum = Math.max(1, Number(data.nextReceiptNumber || 1) - 1);
  } catch {
    // keep defaults
  }

  const invoiceSerial = `${invoicePrefix}-${branchCode}-${String(invoiceNum).padStart(6,'0')}`;
  const receiptNumber = `${receiptPrefix}-${branchCode}-${String(receiptNum).padStart(6,'0')}`;

  const touched = [];
  try {
    for (const it of cleaned) {
      const p = await Product.findOne(productLookupQuery(it.productId));
      if (!p) {
        const err = new Error(`Product not found: ${it.productId}`);
        err.status = 400;
        throw err;
      }
      if (it.variantId) {
        const idx = Array.isArray(p.variants) ? p.variants.findIndex(v => v.id === it.variantId) : -1;
        if (idx < 0) {
          const err = new Error(`Variant not found for product ${p.name}`);
          err.status = 400;
          throw err;
        }
        const v = p.variants[idx];
        if (!v.stockByBranch) v.stockByBranch = new Map();
        const prev = getBranchQty(v.stockByBranch, branchId);
        if (prev < it.qty) {
          const err = new Error(`Insufficient stock for ${p.name} (${v.label}) at ${branchCode}`);
          err.status = 400;
          throw err;
        }
        touched.push({ p, kind: 'variant', idx, branchId, prev });
        setBranchQty(v.stockByBranch, branchId, Math.max(0, prev - it.qty));
        p.variants[idx] = v;
        p.markModified('variants');
        await p.save();
      } else {
        if (!p.stockByBranch) p.stockByBranch = new Map();
        const prev = getBranchQty(p.stockByBranch, branchId);
        if (prev < it.qty) {
          const err = new Error(`Insufficient stock for ${p.name} at ${branchCode}`);
          err.status = 400;
          throw err;
        }
        touched.push({ p, kind: 'base', branchId, prev });
        setBranchQty(p.stockByBranch, branchId, Math.max(0, prev - it.qty));
        p.markModified('stockByBranch');
        await p.save();
      }
    }
  } catch (e) {
    try {
      for (let i = touched.length - 1; i >= 0; i--) {
        const t = touched[i];
        if (t.kind === 'variant') {
          const v = t.p.variants[t.idx];
          if (!v.stockByBranch) v.stockByBranch = new Map();
          setBranchQty(v.stockByBranch, t.branchId, t.prev);
          t.p.variants[t.idx] = v;
          t.p.markModified('variants');
        } else {
          if (!t.p.stockByBranch) t.p.stockByBranch = new Map();
          setBranchQty(t.p.stockByBranch, t.branchId, t.prev);
          t.p.markModified('stockByBranch');
        }
        await t.p.save();
      }
    } catch {}
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed to apply sale stock changes' });
  }

  let sale;
  try {
    sale = await Sale.create({ ...payload, invoiceSerial, receiptNumber });
  } catch (e) {
    try {
      for (let i = touched.length - 1; i >= 0; i--) {
        const t = touched[i];
        if (t.kind === 'variant') {
          const v = t.p.variants[t.idx];
          if (!v.stockByBranch) v.stockByBranch = new Map();
          setBranchQty(v.stockByBranch, t.branchId, t.prev);
          t.p.variants[t.idx] = v;
          t.p.markModified('variants');
        } else {
          if (!t.p.stockByBranch) t.p.stockByBranch = new Map();
          setBranchQty(t.p.stockByBranch, t.branchId, t.prev);
          t.p.markModified('stockByBranch');
        }
        await t.p.save();
      }
    } catch {}
    return res.status(500).json({ error: 'Failed to create sale' });
  }

  await Audit.create({
    actor: sale.sellerName || 'unknown',
    actionType: 'stock_sale_deduct',
    details: { items: sale.items.map(i => ({ sku: i.sku, qty: i.qty, productId: i.productId || null, variantId: i.variantId || null })), invoiceSerial, receiptNumber },
    branchId: sale.branchId,
    ts: new Date()
  });
  try {
    await ServerLog.create({
      level: 'info',
      actor: sale.sellerName || req.user?.name || 'unknown',
      route: '/api/sales',
      method: 'POST',
      status: 200,
      message: `Sale ${sale._id}: ${Array.isArray(sale.items) ? sale.items.map(i => `${i.sku || i.productId} x${i.qty}`).join(', ') : 'items'} @ ${sale.branchId}`,
      details: { invoiceSerial, receiptNumber }
    });
  } catch {}
  res.json(sale);
});

export default r;
