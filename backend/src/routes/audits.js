import { Router } from 'express';
import Audit from '../models/Audit.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/', requireAdmin, async (req, res) => {
  const limit = Math.min(1000, Math.max(50, Number(req.query.limit) || 500));
  const rows = await Audit.find().sort({ ts: -1 }).limit(limit).lean();
  res.set('Cache-Control', 'no-store');
  res.json(rows);
});

export default r;
