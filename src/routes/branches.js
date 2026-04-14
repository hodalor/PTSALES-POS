import { Router } from 'express';
import mongoose from 'mongoose';
import Branch from '../models/Branch.js';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import { requireAdmin } from '../middleware/auth.js';

const r = Router();

function inventoryFieldForBranchType(branchType = 'retail') {
  const kind = String(branchType || 'retail').toLowerCase();
  if (kind === 'warehouse') return 'warehouseStockByBranch';
  if (kind === 'wholesale') return 'wholesaleStockByBranch';
  return 'stockByBranch';
}

async function provisionBranchProducts(branch) {
  if (!branch?.id) return;
  const field = inventoryFieldForBranchType(branch.branchType);
  const products = await Product.find({}, { _id: 1, [field]: 1, variants: 1 });
  for (const product of products) {
    let changed = false;
    if (!product[field]) {
      product[field] = new Map();
      changed = true;
    }
    const existing = typeof product[field]?.get === 'function' ? product[field].get(branch.id) : product[field]?.[branch.id];
    if (existing == null) {
      if (typeof product[field]?.set === 'function') product[field].set(branch.id, 0);
      else product[field][branch.id] = 0;
      changed = true;
    }
    if (Array.isArray(product.variants)) {
      product.variants.forEach(variant => {
        if (!variant[field]) {
          variant[field] = new Map();
          changed = true;
        }
        const variantExisting = typeof variant[field]?.get === 'function' ? variant[field].get(branch.id) : variant[field]?.[branch.id];
        if (variantExisting == null) {
          if (typeof variant[field]?.set === 'function') variant[field].set(branch.id, 0);
          else variant[field][branch.id] = 0;
          changed = true;
        }
      });
    }
    if (changed) {
      product.markModified(field);
      product.markModified('variants');
      await product.save();
    }
  }
}

async function removeBranchProducts(branch) {
  if (!branch?.id) return;
  const fields = ['stockByBranch', 'wholesaleStockByBranch', 'warehouseStockByBranch'];
  const products = await Product.find({}, { _id: 1, stockByBranch: 1, wholesaleStockByBranch: 1, warehouseStockByBranch: 1, variants: 1 });
  for (const product of products) {
    let changed = false;
    fields.forEach(field => {
      if (product[field] && (typeof product[field]?.delete === 'function' ? product[field].has(branch.id) : Object.prototype.hasOwnProperty.call(product[field] || {}, branch.id))) {
        if (typeof product[field]?.delete === 'function') product[field].delete(branch.id);
        else delete product[field][branch.id];
        changed = true;
      }
    });
    if (Array.isArray(product.variants)) {
      product.variants.forEach(variant => {
        fields.forEach(field => {
          if (variant[field] && (typeof variant[field]?.delete === 'function' ? variant[field].has(branch.id) : Object.prototype.hasOwnProperty.call(variant[field] || {}, branch.id))) {
            if (typeof variant[field]?.delete === 'function') variant[field].delete(branch.id);
            else delete variant[field][branch.id];
            changed = true;
          }
        });
      });
    }
    if (changed) {
      fields.forEach(field => product.markModified(field));
      product.markModified('variants');
      await product.save();
    }
  }
}

r.get('/', async (req, res) => {
  const items = await Branch.find().sort({ name: 1 });
  res.json(items);
});

r.post('/', requireAdmin, async (req, res) => {
  const b = await Branch.create(req.body);
  await provisionBranchProducts(b);
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
  if (b) await provisionBranchProducts(b);
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
  const query = { $or: [{ id }] };
  if (mongoose.isValidObjectId(id)) query.$or.unshift({ _id: id });
  const b = await Branch.findOne(query);
  await Branch.findOneAndDelete(query);
  await removeBranchProducts(b);
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
