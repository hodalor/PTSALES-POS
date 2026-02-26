import { Router } from 'express';
import CashSession from '../models/CashSession.js';
import Audit from '../models/Audit.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/me', async (req, res) => {
  const name = req.user?.name || '';
  if (!name) return res.json(null);
  const sess = await CashSession.findOne({ cashierName: name, isOpen: true }).sort({ openedAt: -1 }).lean();
  res.json(sess || null);
});

r.post('/open', requireRoleOrPerm(['Admin','Manager','Cashier'], 'open_cashdrawer'), async (req, res) => {
  const openingFloat = Number(req.body?.openingFloat || 0);
  const existing = await CashSession.findOne({ cashierName: req.user?.name || '', isOpen: true });
  if (existing) return res.status(409).json({ error: 'Session already open' });
  const doc = await CashSession.create({
    branchId: req.user?.branchId || 'main',
    cashierName: req.user?.name || 'unknown',
    cashierRole: req.user?.role || '',
    openingFloat,
    isOpen: true,
    openedAt: new Date(),
    movements: []
  });
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'cashdrawer_open',
    details: { openingFloat },
    branchId: req.user?.branchId || 'main'
  });
  res.json(doc);
});

r.post('/move', requireRoleOrPerm(['Admin','Manager','Cashier'], 'open_cashdrawer'), async (req, res) => {
  const { type, amount, note } = req.body || {};
  const doc = await CashSession.findOne({ cashierName: req.user?.name || '', isOpen: true });
  if (!doc) return res.status(404).json({ error: 'No open session' });
  doc.movements.push({ time: new Date(), type, amount: Number(amount), note });
  await doc.save();
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'cashdrawer_movement',
    details: { type, amount: Number(amount), note },
    branchId: req.user?.branchId || 'main'
  });
  res.json(doc);
});

r.post('/close', requireRoleOrPerm(['Admin','Manager','Cashier'], 'open_cashdrawer'), async (req, res) => {
  const doc = await CashSession.findOne({ cashierName: req.user?.name || '', isOpen: true });
  if (!doc) return res.status(404).json({ error: 'No open session' });
  doc.isOpen = false;
  doc.closedAt = new Date();
  await doc.save();
  await Audit.create({
    actor: req.user?.name || 'unknown',
    actionType: 'cashdrawer_close',
    details: {},
    branchId: req.user?.branchId || 'main'
  });
  res.json(doc);
});

export default r;

