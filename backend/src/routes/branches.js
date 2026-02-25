import { Router } from 'express';
import Branch from '../models/Branch.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAdmin } from '../middleware/auth.js';

const r = Router();

r.get('/', async (req, res) => {
  const items = await Branch.find().sort({ name: 1 });
  res.json(items);
});

r.post('/', requireAdmin, async (req, res) => {
  const b = await Branch.create(req.body);
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'branch_create',
    details: { id: b.id || String(b._id), name: b.name, code: b.code },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'POST',
    status: 200,
    message: `Branch created: ${b.name} (${b.code || ''})`
  });
  res.json(b);
});

r.put('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { $or: [{ _id: id }, { id }] };
  const before = await Branch.findOne(query);
  const b = await Branch.findOneAndUpdate(query, req.body, { new: true });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'branch_update',
    details: { id, before: before ? { name: before.name, code: before.code } : null, after: b ? { name: b.name, code: b.code } : null },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'PUT',
    status: 200,
    message: `Branch updated: ${b ? b.name : id}`
  });
  res.json(b);
});

r.delete('/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { $or: [{ _id: id }, { id }] };
  const b = await Branch.findOne(query);
  await Branch.findOneAndDelete(query);
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'branch_delete',
    details: b ? { id, name: b.name, code: b.code } : { id },
    branchId: req.user?.branchId || ''
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'DELETE',
    status: 200,
    message: `Branch deleted: ${b ? b.name : id}`
  });
  res.json({ ok: true });
});

export default r;
