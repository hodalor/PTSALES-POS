import { Router } from 'express';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();

r.use(requireAuth);

r.get('/', requireRole(['SuperAdmin']), async (req, res) => {
  const limit = Math.min(1000, Math.max(50, Number(req.query.limit) || 500));
  const rows = await ServerLog.find().sort({ ts: -1 }).limit(limit);
  res.set('Cache-Control', 'no-store');
  res.json(rows);
});

export default r;
