import { Router } from 'express';
import Expense from '../models/Expense.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import mongoose from 'mongoose';

const r = Router();

r.use(requireAuth);

r.get('/', async (req, res) => {
  const branchId = String(req.query.branchId || '');
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const q = {};
  if (branchId) q.branchId = branchId;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
  }
  const rows = await Expense.find(q).sort({ date: -1, createdAt: -1 }).limit(2000);
  res.json(rows);
});

r.post('/', requireRoleOrPerm(['Admin','Manager'], 'add_expenses'), async (req, res) => {
  const { branchId, date, category, amount, note, clientId } = req.body || {};
  if (!branchId || !date || !category) return res.status(400).json({ error: 'Missing branchId/date/category' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
  const cid = String(clientId || '').trim();
  if (cid) {
    const existing = await Expense.findOne({ clientId: cid });
    if (existing) return res.json(existing);
  }
  const row = await Expense.create({
    clientId: cid || undefined,
    branchId: String(branchId),
    date: new Date(date),
    category: String(category),
    amount: amt,
    note: String(note || ''),
    createdBy: req.user?.name || ''
  });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'expense_create',
    details: { id: String(row._id), branchId: row.branchId, category: row.category, amount: row.amount },
    branchId: row.branchId
  });
  await ServerLog.create({
    level: 'info',
    actor: req.user?.name || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'POST',
    status: 200,
    message: `Expense created: ${row.category} ${row.amount} @ ${row.branchId}`
  });
  res.json(row);
});

r.put('/:id', requireRoleOrPerm(['Admin','Manager'], 'add_expenses'), async (req, res) => {
  const id = String(req.params.id || '');
  const or = [];
  if (mongoose.isValidObjectId(id)) or.push({ _id: id });
  or.push({ clientId: id });
  const { branchId, date, category, amount, note } = req.body || {};
  const patch = {};
  if (branchId) patch.branchId = String(branchId);
  if (date) patch.date = new Date(date);
  if (category) patch.category = String(category);
  if (amount != null) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    patch.amount = amt;
  }
  if (note != null) patch.note = String(note || '');
  const row = await Expense.findOneAndUpdate({ $or: or }, patch, { new: true });
  if (!row) return res.status(404).json({ error: 'Not found' });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'expense_update',
    details: { id: String(row._id), branchId: row.branchId, category: row.category, amount: row.amount },
    branchId: row.branchId
  });
  res.json(row);
});

r.delete('/:id', requireRoleOrPerm(['Admin','Manager'], 'add_expenses'), async (req, res) => {
  const id = String(req.params.id || '');
  const or = [];
  if (mongoose.isValidObjectId(id)) or.push({ _id: id });
  or.push({ clientId: id });
  const row = await Expense.findOneAndDelete({ $or: or });
  if (!row) return res.status(404).json({ error: 'Not found' });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'expense_delete',
    details: { id: String(row._id), branchId: row.branchId, category: row.category, amount: row.amount },
    branchId: row.branchId
  });
  res.json({ ok: true });
});

export default r;
