import { Router } from 'express';
import { requireRoleOrPerm } from '../middleware/auth.js';
import Product from '../models/Product.js';
import Branch from '../models/Branch.js';
import Sale from '../models/Sale.js';
import Invoice from '../models/Invoice.js';
import Supplier from '../models/Supplier.js';
import Customer from '../models/Customer.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import ServerLog from '../models/ServerLog.js';
import Audit from '../models/Audit.js';
import CashSession from '../models/CashSession.js';
import Expense from '../models/Expense.js';
import Approval from '../models/Approval.js';
import CreditSale from '../models/CreditSale.js';
import CreditRepayment from '../models/CreditRepayment.js';
import ProductUnit from '../models/ProductUnit.js';
import PurchaseRequest from '../models/PurchaseRequest.js';
import TransferRequest from '../models/TransferRequest.js';
import AdjustmentRequest from '../models/AdjustmentRequest.js';
import RefundRequest from '../models/RefundRequest.js';
import ExpenseRequest from '../models/ExpenseRequest.js';
import WholesaleOperation from '../models/WholesaleOperation.js';
import Category from '../models/Category.js';

const r = Router();

const COLLECTIONS = [
  { key: 'settings', model: Settings, uniqueKeys: ['key'] },
  { key: 'users', model: User, uniqueKeys: ['name'] },
  { key: 'branches', model: Branch, uniqueKeys: ['id'] },
  { key: 'categories', model: Category, uniqueKeys: ['name'] },
  { key: 'products', model: Product, uniqueKeys: ['sku', 'id'] },
  { key: 'productUnits', model: ProductUnit, uniqueKeys: ['imei', 'serialNumber'] },
  { key: 'suppliers', model: Supplier, uniqueKeys: ['clientId'] },
  { key: 'customers', model: Customer, uniqueKeys: ['clientId', 'customerCode'] },
  { key: 'sales', model: Sale, uniqueKeys: ['clientId'] },
  { key: 'invoices', model: Invoice, uniqueKeys: ['clientId', 'number'] },
  { key: 'expenses', model: Expense, uniqueKeys: ['clientId'] },
  { key: 'cashsessions', model: CashSession, uniqueKeys: ['clientId'] },
  { key: 'approvals', model: Approval, uniqueKeys: ['referenceModel', 'referenceId'] },
  { key: 'creditSales', model: CreditSale, uniqueKeys: ['saleId'] },
  { key: 'creditRepayments', model: CreditRepayment, uniqueKeys: ['approvalId'] },
  { key: 'purchaseRequests', model: PurchaseRequest, uniqueKeys: ['clientId'] },
  { key: 'transferRequests', model: TransferRequest, uniqueKeys: ['clientId'] },
  { key: 'adjustmentRequests', model: AdjustmentRequest, uniqueKeys: ['clientId'] },
  { key: 'refundRequests', model: RefundRequest, uniqueKeys: ['clientId'] },
  { key: 'expenseRequests', model: ExpenseRequest, uniqueKeys: ['clientId'] },
  { key: 'wholesaleOperations', model: WholesaleOperation, uniqueKeys: ['clientId'] },
  { key: 'audits', model: Audit, uniqueKeys: [] },
  { key: 'serverLogs', model: ServerLog, uniqueKeys: [] }
];

function normalizeDoc(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const doc = { ...raw };
  if (Object.prototype.hasOwnProperty.call(doc, '__v')) delete doc.__v;
  if (doc._id === '') delete doc._id;
  return doc;
}

function pickUniqueFilter(doc, uniqueKeys = []) {
  if (doc && doc._id) return { _id: doc._id };
  for (const key of uniqueKeys || []) {
    const value = doc?.[key];
    if (value === undefined || value === null || value === '') continue;
    return { [key]: value };
  }
  return null;
}

async function mergeCollection(def, docs = []) {
  const out = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const model = def.model;
  for (const raw of docs) {
    const doc = normalizeDoc(raw);
    if (!doc) {
      out.skipped += 1;
      continue;
    }
    const filter = pickUniqueFilter(doc, def.uniqueKeys);
    try {
      if (!filter) {
        await model.create(doc);
        out.inserted += 1;
        continue;
      }
      const exists = await model.findOne(filter, { _id: 1 }).lean();
      await model.replaceOne(filter, doc, { upsert: true, runValidators: false, strict: false });
      if (exists) out.updated += 1; else out.inserted += 1;
    } catch (e) {
      out.skipped += 1;
      out.errors.push(String(e?.message || 'Failed'));
    }
  }
  return out;
}

async function overrideCollection(def, docs = []) {
  const out = { inserted: 0, updated: 0, skipped: 0, errors: [] };
  const model = def.model;
  try {
    await model.deleteMany({});
  } catch (e) {
    out.errors.push(`Failed to clear collection: ${String(e?.message || 'Unknown error')}`);
    out.skipped = docs.length;
    return out;
  }
  const normalized = docs.map(normalizeDoc).filter(Boolean);
  if (normalized.length === 0) return out;
  try {
    await model.insertMany(normalized, { ordered: false });
    out.inserted = normalized.length;
  } catch (e) {
    out.inserted = Number(e?.result?.result?.nInserted || e?.insertedDocs?.length || 0);
    out.skipped = Math.max(0, normalized.length - out.inserted);
    out.errors.push(String(e?.message || 'Partial import failure'));
  }
  return out;
}

r.get('/export', requireRoleOrPerm(['SuperAdmin'], 'export_data'), async (_req, res) => {
  const collections = {};
  const counts = {};
  for (const def of COLLECTIONS) {
    const rows = await def.model.find({}).lean();
    collections[def.key] = rows;
    counts[def.key] = rows.length;
  }
  res.json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    counts,
    collections
  });
});

r.post('/import', requireRoleOrPerm(['SuperAdmin'], 'import_data'), async (req, res) => {
  const body = req.body || {};
  const mode = String(body.mode || 'merge').toLowerCase() === 'override' ? 'override' : 'merge';
  const inputCollections = (body?.collections && typeof body.collections === 'object')
    ? body.collections
    : ((body?.data?.collections && typeof body.data.collections === 'object') ? body.data.collections : {});
  if (!inputCollections || Object.keys(inputCollections).length === 0) {
    return res.status(400).json({ error: 'No collections supplied for import' });
  }

  const result = {
    mode,
    startedAt: new Date().toISOString(),
    byCollection: {},
    totals: { inserted: 0, updated: 0, skipped: 0 }
  };

  for (const def of COLLECTIONS) {
    const docs = Array.isArray(inputCollections[def.key]) ? inputCollections[def.key] : null;
    if (!docs) continue;
    const stats = mode === 'override'
      ? await overrideCollection(def, docs)
      : await mergeCollection(def, docs);
    result.byCollection[def.key] = stats;
    result.totals.inserted += Number(stats.inserted || 0);
    result.totals.updated += Number(stats.updated || 0);
    result.totals.skipped += Number(stats.skipped || 0);
  }

  result.finishedAt = new Date().toISOString();
  return res.json(result);
});

export default r;
