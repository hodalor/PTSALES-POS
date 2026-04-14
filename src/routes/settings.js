import { Router } from 'express';
import Settings from '../models/Settings.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const r = Router();

r.use(requireAuth);

r.get('/', async (req, res) => {
  let doc = await Settings.findOne({ key: 'default' });
  if (!doc) return res.json({});
  res.json(doc.data || {});
});

r.put('/', requireAdmin, async (req, res) => {
  const data = req.body || {};
  const role = String(req.user?.role || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(data, 'featureFlags') && role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const prev = await Settings.findOne({ key: 'default' });
  const before = prev && prev.data ? prev.data : {};
  const nextData = { ...before, ...data };
  let doc = await Settings.findOneAndUpdate({ key: 'default' }, { data: nextData }, { new: true, upsert: true });
  const after = doc && doc.data ? doc.data : {};
  const changed = [];
  Object.keys(data || {}).forEach(k => {
    try {
      const a = JSON.stringify(before[k]);
      const b = JSON.stringify(after[k]);
      if (a !== b) changed.push(k);
    } catch {
      changed.push(k);
    }
  });
  res.json(after || {});
  void Audit.create({
    actor: (req.user && req.user.name) || 'unknown',
    actionType: 'settings_update',
    details: { changedKeys: changed, count: changed.length },
    branchId: req.user?.branchId || ''
  }).catch(() => {});
  void ServerLog.create({
    level: 'info',
    actor: (req.user && req.user.name) || 'unknown',
    route: req.originalUrl || req.url || '',
    method: req.method || 'PUT',
    status: 200,
    message: 'Settings updated',
    details: { changedKeys: changed, count: changed.length }
  }).catch(() => {});
});

export default r;
