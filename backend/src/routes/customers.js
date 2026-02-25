import { Router } from 'express';
import Customer from '../models/Customer.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireAdmin, requireRole, requireRoleOrPerm } from '../middleware/auth.js';

const r = Router();

r.use(requireAuth);

r.get('/', async (req, res) => {
  const rows = await Customer.find().sort({ createdAt: -1 }).limit(1000);
  res.json(rows);
});

r.post('/', requireRoleOrPerm(['Admin','Manager','Cashier'], 'add_customers'), async (req, res) => {
  const c = await Customer.create(req.body);
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'customer_create',
    details: { name: c.name, phone: c.phone || '', email: c.email || '' },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'POST',
    status: 200,
    message: `Customer created: ${c.name}`
  });
  res.json(c);
});

r.put('/:id', requireRoleOrPerm(['Admin','Manager','Cashier'], 'edit_customers'), async (req, res) => {
  const id = req.params.id;
  const query = { $or: [{ _id: id }, { id }] };
  const before = await Customer.findOne(query);
  const c = await Customer.findOneAndUpdate(query, req.body, { new: true });
  const changed = [];
  const payload = req.body || {};
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
    actor: req.user?.name || 'unknown',
    actionType: 'customer_update',
    details: { id, name: c?.name || before?.name || '', changedKeys: changed },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'PUT',
    status: 200,
    message: `Customer updated: ${c?.name || id}`,
    details: { changedKeys: changed }
  });
  res.json(c);
});

r.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const doc = await Customer.findOne({ $or: [{ _id: id }, { id }] });
  await Customer.findOneAndDelete({ $or: [{ _id: id }, { id }] });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'customer_delete',
    details: { id, name: doc?.name || '' },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'DELETE',
    status: 200,
    message: `Customer deleted: ${doc?.name || id}`
  });
  res.json({ ok: true });
});

export default r;
