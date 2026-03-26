import { Router } from 'express';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import AdjustmentRequest from '../models/AdjustmentRequest.js';
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

async function adjustBaseStock(productId, branchId, delta) {
  const p = await Product.findOne(productLookupQuery(productId));
  if (!p) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  if (!p.stockByBranch) p.stockByBranch = new Map();
  const cur = getBranchQty(p.stockByBranch, branchId);
  setBranchQty(p.stockByBranch, branchId, Math.max(0, cur + Number(delta)));
  p.markModified('stockByBranch');
  await p.save();
  return p;
}

async function adjustVariantStock(productId, variantId, branchId, delta) {
  const p = await Product.findOne(productLookupQuery(productId));
  if (!p) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const idx = variants.findIndex(v => v.id === variantId);
  if (idx < 0) {
    const err = new Error('Variant not found');
    err.status = 400;
    throw err;
  }
  const v = variants[idx];
  if (!v.stockByBranch) v.stockByBranch = new Map();
  const cur = getBranchQty(v.stockByBranch, branchId);
  setBranchQty(v.stockByBranch, branchId, Math.max(0, cur + Number(delta)));
  p.variants[idx] = v;
  p.markModified('variants');
  await p.save();
  return p;
}

r.get('/requests', requireRoleOrPerm(['Admin','Manager'], 'approve_adjustments'), async (req, res) => {
  const statusRaw = String(req.query.status || '').trim().toLowerCase();
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 200));
  const map = { pending: 'pending_approval', approved: 'approved', rejected: 'rejected' };
  const q = {};
  if (map[statusRaw]) q.status = map[statusRaw];
  const rows = await AdjustmentRequest.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json(rows);
});

r.post('/requests', requireRoleOrPerm(['Admin','Manager','Inventory Staff'], 'add_adjustments'), async (req, res) => {
  const { productId, branchId, delta, variantId, remark, clientId } = req.body || {};
  if (!productId || !branchId) return res.status(400).json({ error: 'Missing productId or branchId' });
  if (!Number.isFinite(Number(delta)) || Number(delta) === 0) return res.status(400).json({ error: 'Delta must be non-zero number' });
  const cid = String(clientId || '').trim();
  if (cid) {
    const existing = await AdjustmentRequest.findOne({ clientId: cid });
    if (existing) return res.json(existing);
  }
  const row = await AdjustmentRequest.create({
    clientId: cid || undefined,
    productId: String(productId),
    variantId: variantId ? String(variantId) : undefined,
    branchId: String(branchId),
    delta: Number(delta),
    remark: String(remark || ''),
    initiatorName: req.user?.name || '',
    initiatorRole: req.user?.role || ''
  });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'adjustment_request_create',
    details: { id: String(row._id), productId: row.productId, variantId: row.variantId || '', delta: row.delta, branchId: row.branchId },
    remark: row.remark || '',
    branchId: row.branchId
  });
  res.json(row);
});

r.post('/approve', requireRoleOrPerm(['Admin','Manager'], 'approve_adjustments'), async (req, res) => {
  const { id, remark } = req.body || {};
  const row = await AdjustmentRequest.findById(id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.status !== 'pending_approval') return res.status(400).json({ error: 'Request not pending' });
  let p;
  try {
    if (row.variantId) {
      p = await adjustVariantStock(row.productId, row.variantId, row.branchId, row.delta);
    } else {
      p = await adjustBaseStock(row.productId, row.branchId, row.delta);
    }
  } catch (e) {
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed to apply adjustment' });
  }
  row.status = 'approved';
  row.approverName = req.user?.name || '';
  row.approverRole = req.user?.role || '';
  row.approvalRemark = String(remark || '');
  row.approved_at = new Date();
  await row.save();
  const varLabel = (Array.isArray(p?.variants) ? p.variants.find(v => v.id === row.variantId)?.label : '') || '';
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'stock_adjust',
    details: { product: p?.name || row.productId, variant: varLabel, delta: Number(row.delta), branchId: row.branchId },
    remark: row.remark || '',
    branchId: row.branchId
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: '/api/adjustments/approve',
    method: 'POST',
    status: 200,
    message: `Adjustment approved Δ ${Number(row.delta)} for ${p?.name || row.productId} @ ${row.branchId}${row.variantId ? ` (variant ${varLabel})` : ''}`
  });
  res.json({ ok: true, request: row });
});

r.post('/reject', requireRoleOrPerm(['Admin','Manager'], 'approve_adjustments'), async (req, res) => {
  const { id, remark } = req.body || {};
  const row = await AdjustmentRequest.findById(id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.status !== 'pending_approval') return res.status(400).json({ error: 'Request not pending' });
  row.status = 'rejected';
  row.approverName = req.user?.name || '';
  row.approverRole = req.user?.role || '';
  row.rejectionRemark = String(remark || '');
  row.rejected_at = new Date();
  await row.save();
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'adjustment_reject',
    details: { id: String(row._id), productId: row.productId, variantId: row.variantId || '', delta: row.delta, branchId: row.branchId },
    remark: String(remark || ''),
    branchId: row.branchId
  });
  res.json({ ok: true, request: row });
});

export default r;
