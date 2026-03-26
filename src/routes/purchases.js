import { Router } from 'express';
import mongoose from 'mongoose';
import PurchaseRequest from '../models/PurchaseRequest.js';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';

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
  if (typeof mapLike.set === 'function') mapLike.set(branchId, qty);
  else mapLike[branchId] = qty;
}

r.get('/requests', async (req, res) => {
  const role = String(req.user?.role || '').toLowerCase();
  const assigned = req.user?.assignedBranches ?? 'all';
  const statusRaw = String(req.query?.status || '').trim().toLowerCase();
  const map = { pending: 'pending_approval', approved: 'approved', rejected: 'rejected' };
  const q = {};
  if (map[statusRaw]) q.status = map[statusRaw];
  if (!(role === 'superadmin' || role === 'admin') && assigned !== 'all') {
    const arr = Array.isArray(assigned) ? assigned : [assigned];
    q.branchId = { $in: arr };
  }
  const limit = Math.min(1000, Math.max(20, Number(req.query?.limit || 200)));
  const rows = await PurchaseRequest.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  res.json(rows);
});

r.post('/requests', requireRoleOrPerm(['Admin','Manager','Inventory Staff'], 'add_purchases'), async (req, res) => {
  const payload = req.body || {};
  const clientId = String(payload.clientId || '').trim();
  if (clientId) {
    const existing = await PurchaseRequest.findOne({ clientId });
    if (existing) return res.json(existing);
  }
  const pr = await PurchaseRequest.create({
    ...payload,
    status: 'pending_approval',
    clientId: clientId || undefined
  });
  await Audit.create({
    actor: pr.initiatorName || 'unknown',
    actionType: 'purchase_initiated',
    details: { productId: pr.productId, variantId: pr.variantId || '', baseUnits: Number(pr.baseUnits || 0), supplier: pr.supplier || '', cost: Number(pr.cost) || 0 },
    remark: pr.remark || '',
    branchId: pr.branchId
  });
  res.json(pr);
});

r.post('/approve', requireRoleOrPerm(['Admin','Manager'], 'approve_purchases'), async (req, res) => {
  const { id, approverName, approverRole, remark } = req.body || {};
  if (!remark || !String(remark).trim()) return res.status(400).json({ error: 'Approval remark required' });
  const key = String(id || '');
  const or = [];
  if (mongoose.isValidObjectId(key)) or.push({ _id: key });
  or.push({ clientId: key });
  const pr = await PurchaseRequest.findOne({ $or: or });
  if (!pr) return res.status(404).json({ error: 'Not found' });
  if (pr.status !== 'pending_approval') return res.json(pr);
  const role = String(req.user?.role || '').toLowerCase();
  const assigned = req.user?.assignedBranches ?? 'all';
  if (!(role === 'superadmin' || role === 'admin')) {
    if (assigned !== 'all') {
      const arr = Array.isArray(assigned) ? assigned : [assigned];
      if (!arr.includes(pr.branchId)) return res.status(403).json({ error: 'Forbidden for branch' });
    }
  }

  const { productId, variantId, branchId, baseUnits, supplier, cost, costPerUnit, expiryDate } = pr;

  let p;
  // adjust stock similar to /api/stock/receive
  try {
    const q = Number(baseUnits);
    if (!Number.isFinite(q) || q <= 0) return res.status(400).json({ error: 'baseUnits must be a positive number' });
    const doc = await Product.findOne(productLookupQuery(productId));
    if (!doc) return res.status(404).json({ error: 'Product not found' });
    if (variantId) {
      const variants = Array.isArray(doc.variants) ? doc.variants : [];
      const idx = variants.findIndex(v => v.id === variantId);
      if (idx < 0) return res.status(400).json({ error: 'Variant not found' });
      const v = variants[idx];
      if (!v.stockByBranch) v.stockByBranch = new Map();
      const cur = getBranchQty(v.stockByBranch, branchId);
      setBranchQty(v.stockByBranch, branchId, Math.max(0, cur + q));
      doc.variants[idx] = v;
      doc.markModified('variants');
      await doc.save();
      p = doc;
    } else {
      if (!doc.stockByBranch) doc.stockByBranch = new Map();
      const cur = getBranchQty(doc.stockByBranch, branchId);
      setBranchQty(doc.stockByBranch, branchId, Math.max(0, cur + Number(q)));
      doc.markModified('stockByBranch');
      await doc.save();
      p = doc;
    }
    const cpu = costPerUnit != null ? Number(costPerUnit) : null;
    if (cpu != null && Number.isFinite(cpu) && cpu >= 0) {
      p.costPrice = cpu;
    }
    if (expiryDate) {
      const dt = new Date(expiryDate);
      if (!Number.isNaN(dt.getTime())) p.expiryDate = dt;
    }
    if (cpu != null || expiryDate) {
      await p.save();
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Failed to receive stock' });
  }

  pr.status = 'approved';
  pr.approverName = approverName || 'unknown';
  pr.approverRole = approverRole || '';
  pr.approvalRemark = String(remark || '').trim();
  pr.approved_at = new Date();
  await pr.save();

  const varLabel = (Array.isArray(p?.variants) ? p.variants.find(v => v.id === pr.variantId)?.label : '') || '';
  await Audit.create({
    actor: approverName || 'unknown',
    actionType: 'stock_receive',
    details: { product: p?.name || pr.productId, variant: varLabel, baseUnits: Number(pr.baseUnits), supplier: pr.supplier || '', cost: Number(pr.cost) || 0, costPerUnit: Number(pr.costPerUnit || 0), expiryDate: pr.expiryDate || null, branchId: pr.branchId },
    remark: remark || pr.remark || '',
    branchId: pr.branchId
  });
  try {
    await ServerLog.create({
      level: 'info',
      actor: approverName || req.user?.name || 'unknown',
      route: '/api/purchases/approve',
      method: 'POST',
      status: 200,
      message: `Purchase approved +${Number(pr.baseUnits)} for ${p?.name || pr.productId} @ ${pr.branchId}${pr.variantId ? ` (variant ${varLabel})` : ''}`
    });
  } catch {}
  res.json(pr);
});

r.post('/reject', requireRoleOrPerm(['Admin','Manager'], 'approve_purchases'), async (req, res) => {
  const { id, approverName, approverRole, remark } = req.body || {};
  if (!remark || !String(remark).trim()) return res.status(400).json({ error: 'Rejection remark required' });
  const key = String(id || '');
  const or = [];
  if (mongoose.isValidObjectId(key)) or.push({ _id: key });
  or.push({ clientId: key });
  const pr = await PurchaseRequest.findOne({ $or: or });
  if (!pr) return res.status(404).json({ error: 'Not found' });
  if (pr.status !== 'pending_approval') return res.json(pr);
  const role = String(req.user?.role || '').toLowerCase();
  const assigned = req.user?.assignedBranches ?? 'all';
  if (!(role === 'superadmin' || role === 'admin')) {
    if (assigned !== 'all') {
      const arr = Array.isArray(assigned) ? assigned : [assigned];
      if (!arr.includes(pr.branchId)) return res.status(403).json({ error: 'Forbidden for branch' });
    }
  }
  pr.status = 'rejected';
  pr.approverName = approverName || 'unknown';
  pr.approverRole = approverRole || '';
  pr.rejectionRemark = String(remark || '').trim();
  pr.rejected_at = new Date();
  await pr.save();
  await Audit.create({
    actor: approverName || 'unknown',
    actionType: 'purchase_rejected',
    details: { productId: pr.productId, baseUnits: Number(pr.baseUnits || 0) },
    remark: pr.rejectionRemark || pr.remark || '',
    branchId: pr.branchId
  });
  res.json(pr);
});

export default r;
