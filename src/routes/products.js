import { Router } from 'express';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireAdmin, requireRole, requireRoleOrPerm } from '../middleware/auth.js';
import mongoose from 'mongoose';

const r = Router();

r.use(requireAuth);

function productLookupQuery(productId) {
  const pid = String(productId || '');
  const or = [{ id: pid }];
  if (mongoose.isValidObjectId(pid)) or.unshift({ _id: pid });
  return { $or: or };
}

function normalizeStockByBranch(x) {
  if (!x) return {};
  if (x instanceof Map) return Object.fromEntries(x.entries());
  if (typeof x === 'object') return x;
  return {};
}

function pad12Digits(n) {
  const s = String(n).replace(/\D/g, '');
  if (s.length >= 12) return s.slice(-12);
  return (s + '000000000000').slice(0, 12);
}
function ean13CheckDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(d12[i]);
    sum += (i % 2 === 0) ? d : d * 3;
  }
  const mod = sum % 10;
  return String((10 - mod) % 10);
}
function generateEAN13() {
  const base = pad12Digits(String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));
  return base + ean13CheckDigit(base);
}

r.get('/', async (req, res) => {
  const items = await Product.find().sort({ createdAt: -1 }).limit(1000);
  // Backfill missing barcodes
  const toUpdate = items.filter(p => !p.barcode);
  if (toUpdate.length > 0) {
    await Promise.allSettled(toUpdate.map(async p => {
      p.barcode = generateEAN13();
      try { await p.save(); } catch {}
    }));
  }
  const mapped = items.map(p => {
    const obj = p.toObject ? p.toObject({ flattenMaps: true }) : p;
    if (!obj.id && obj._id) obj.id = String(obj._id);
    obj.stockByBranch = normalizeStockByBranch(obj.stockByBranch);
    if (Array.isArray(obj.variants)) {
      obj.variants = obj.variants.map((v, idx) => ({ id: v.id || v.label || String(idx), label: v.label, sku: v.sku || '', price: v.price, stockByBranch: normalizeStockByBranch(v.stockByBranch) }));
    }
    return obj;
  });
  res.json(mapped);
});

r.post('/', requireRoleOrPerm(['Admin','Manager'], 'edit_products'), async (req, res) => {
  const body = req.body || {};
  if (!body.barcode) body.barcode = generateEAN13();
  const p = await Product.create(body);
  if (!p.id) {
    p.id = String(p._id);
    try { await p.save(); } catch {}
  }
  await Audit.create({
    actor: (req.user && req.user.name) || 'unknown',
    actionType: 'product_create',
    details: { name: p.name, sku: p.sku, price: p.price, category: p.category || '' },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: (req.user && req.user.name) || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'POST',
    status: 200,
    message: `Product created: ${p.name} (${p.sku})`
  });
  res.json(p);
});

r.put('/:id', requireRoleOrPerm(['Admin','Manager'], 'edit_products'), async (req, res) => {
  const id = req.params.id;
  const query = productLookupQuery(id);
  const before = await Product.findOne(query);
  const payload = req.body || {};
  if (payload && payload.stockByBranch != null) {
    delete payload.stockByBranch;
  }
  if (Array.isArray(payload?.variants)) {
    payload.variants = payload.variants.map(v => {
      const out = { ...(v || {}) };
      if (out.stockByBranch != null) delete out.stockByBranch;
      return out;
    });
  }
  if (!payload.id && before?.id) {
    payload.id = before.id;
  }
  const p = await Product.findOneAndUpdate(query, payload, { new: true });
  const changed = [];
  Object.keys(payload).forEach(k => {
    try {
      const a = before ? JSON.stringify(before[k]) : undefined;
      const b = JSON.stringify(payload[k]);
      if (a !== b) changed.push(k);
    } catch {
      changed.push(k);
    }
  });
  await Audit.create({
    actor: (req.user && req.user.name) || 'unknown',
    actionType: 'product_update',
    details: { id, name: p?.name || before?.name || '', sku: p?.sku || before?.sku || '', changedKeys: changed },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: (req.user && req.user.name) || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'PUT',
    status: 200,
    message: `Product updated: ${p?.name || id}`,
    details: { changedKeys: changed }
  });
  res.json(p);
});

r.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const query = productLookupQuery(id);
  const doc = await Product.findOne(query);
  await Product.findOneAndDelete(query);
  await Audit.create({
    actor: (req.user && req.user.name) || 'unknown',
    actionType: 'product_delete',
    details: { id, name: doc?.name || '', sku: doc?.sku || '' },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: (req.user && req.user.name) || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'DELETE',
    status: 200,
    message: `Product deleted: ${doc?.name || id}`
  });
  res.json({ ok: true });
});

export default r;
