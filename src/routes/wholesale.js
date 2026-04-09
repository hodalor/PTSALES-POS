import { Router } from 'express';
import WholesaleOperation from '../models/WholesaleOperation.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import { createApprovalForReference } from '../utils/approvalWorkflow.js';

const r = Router();

r.use(requireAuth);

function permissionForOperation(type = '') {
  const key = String(type || '').toLowerCase();
  if (key === 'purchase') return 'add_purchases';
  if (key === 'transfer') return 'add_transfers';
  if (key === 'adjustment') return 'add_adjustments';
  if (key === 'refund') return 'add_refunds';
  return '';
}

r.get('/operations', async (req, res) => {
  const query = {};
  if (req.query.status) query.status = String(req.query.status);
  if (req.query.operationType) query.operationType = String(req.query.operationType);
  const role = String(req.user?.role || '').toLowerCase();
  const assigned = req.user?.assignedBranches ?? 'all';
  if (!(role === 'superadmin' || role === 'admin') && assigned !== 'all') {
    const arr = Array.isArray(assigned) ? assigned : [assigned];
    if (String(req.query.operationType || '').toLowerCase() === 'transfer') {
      query.$or = [
        { fromBranchId: { $in: arr } },
        { toBranchId: { $in: arr } },
        { branchId: { $in: arr } }
      ];
    } else {
      query.branchId = { $in: arr };
    }
  }
  const rows = await WholesaleOperation.find(query).sort({ createdAt: -1 }).limit(500);
  res.json(rows);
});

r.post('/operations', requireRoleOrPerm(['Admin', 'Manager', 'Inventory Staff'], 'add_purchases'), async (req, res) => {
  const body = req.body || {};
  const operationType = String(body.operationType || '').toLowerCase();
  if (!['purchase', 'transfer', 'adjustment', 'refund'].includes(operationType)) {
    return res.status(400).json({ error: 'Invalid operationType' });
  }
  const specificPerm = permissionForOperation(operationType);
  const role = String(req.user?.role || '').toLowerCase();
  const grants = Array.isArray(req.user?.grants) ? req.user.grants : [];
  if (!['admin', 'manager', 'inventory staff', 'superadmin'].includes(role) && specificPerm && !grants.includes(specificPerm)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const qty = Math.max(0, Number(body.qty || 0));
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero' });
  if (!body.productId) return res.status(400).json({ error: 'Missing productId' });
  if (operationType === 'transfer' && (!body.fromBranchId || !body.toBranchId)) {
    return res.status(400).json({ error: 'Transfer requires fromBranchId and toBranchId' });
  }
  if (operationType !== 'transfer' && !body.branchId) {
    return res.status(400).json({ error: 'Branch is required' });
  }
  const op = await WholesaleOperation.create({
    clientId: body.clientId || undefined,
    operationType,
    productId: String(body.productId),
    variantId: String(body.variantId || ''),
    branchId: String(body.branchId || ''),
    fromBranchId: String(body.fromBranchId || ''),
    toBranchId: String(body.toBranchId || ''),
    fromInventoryType: String(body.fromInventoryType || 'wholesale'),
    toInventoryType: String(body.toInventoryType || (operationType === 'transfer' ? 'wholesale' : 'wholesale')),
    qty,
    cost: Number(body.cost || 0),
    requestedAmount: Number(body.requestedAmount || 0),
    adjustmentType: String(body.adjustmentType || 'increase'),
    supplier: String(body.supplier || ''),
    reason: String(body.reason || ''),
    remark: String(body.remark || ''),
    initiatedByName: req.user?.name || 'unknown',
    initiatedByRole: req.user?.role || '',
    status: 'pending_director'
  });
  const approval = await createApprovalForReference({
    actionType: `wholesale_${operationType}`,
    referenceModel: 'WholesaleOperation',
    referenceId: String(op._id),
    initiatedByName: req.user?.name || 'unknown',
    initiatedByRole: req.user?.role || ''
  });
  const fresh = await WholesaleOperation.findById(op._id);
  res.json({ operation: fresh, approval });
});

export default r;
