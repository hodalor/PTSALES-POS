import { Router } from 'express';
import RefundRequest from '../models/RefundRequest.js';
import Audit from '../models/Audit.js';
import { requireAuth, requireRole, requireRoleOrPerm } from '../middleware/auth.js';

const r = Router();

r.use(requireAuth);

r.get('/requests', async (req, res) => {
  const rows = await RefundRequest.find().sort({ created_at: -1 }).limit(500);
  res.json(rows);
});

r.post('/requests', requireRoleOrPerm(['Admin','Manager','Cashier'], 'add_refunds'), async (req, res) => {
  const rfd = await RefundRequest.create(req.body);
  await Audit.create({
    actor: rfd.initiatorName || 'unknown',
    actionType: 'refund_initiated',
    details: { saleId: rfd.saleId, amount: rfd.requestedAmount, type: rfd.type },
    branchId: rfd.branchId
  });
  res.json(rfd);
});

r.post('/approve', requireRoleOrPerm(['Admin','Manager'], 'approve_refunds'), async (req, res) => {
  const { id, approverName, approverRole, approvalRemark, restockMode, restockItems } = req.body || {};
  const rfd = await RefundRequest.findById(id);
  if (!rfd || rfd.status !== 'pending_approval') return res.status(404).json({ error: 'Not found' });
  rfd.status = 'approved';
  rfd.approverName = approverName || 'unknown';
  rfd.approverRole = approverRole || '';
  rfd.approvalRemark = approvalRemark || '';
  rfd.restockMode = restockMode || 'none';
  if (Array.isArray(restockItems)) rfd.restockItems = restockItems.map(x => ({ sku: x.sku, qty: Number(x.qty) || 0 }));
  rfd.approved_at = new Date();
  await rfd.save();
  await Audit.create({
    actor: approverName || 'unknown',
    actionType: rfd.restockMode !== 'none' ? 'stock_restock_refund' : 'refund_approved',
    details: { saleId: rfd.saleId, items: rfd.restockItems || [] },
    branchId: rfd.branchId
  });
  res.json(rfd);
});

r.post('/reject', requireRoleOrPerm(['Admin','Manager'], 'approve_refunds'), async (req, res) => {
  const { id, approverName, approverRole, remark } = req.body || {};
  const rfd = await RefundRequest.findById(id);
  if (!rfd || rfd.status !== 'pending_approval') return res.status(404).json({ error: 'Not found' });
  rfd.status = 'rejected';
  rfd.rejectionRemark = remark || '';
  rfd.approverName = approverName || 'unknown';
  rfd.approverRole = approverRole || '';
  rfd.rejected_at = new Date();
  await rfd.save();
  await Audit.create({
    actor: approverName || 'unknown',
    actionType: 'refund_rejected',
    details: { saleId: rfd.saleId },
    branchId: rfd.branchId
  });
  res.json(rfd);
});

export default r;
