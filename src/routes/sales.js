import { Router } from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import Audit from '../models/Audit.js';
import ServerLog from '../models/ServerLog.js';
import Settings from '../models/Settings.js';
import Branch from '../models/Branch.js';
import Customer from '../models/Customer.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import mongoose from 'mongoose';

const r = Router();

r.use(requireAuth);

function productLookupQuery(productId) {
  const pid = String(productId || '');
  const or = [{ id: pid }];
  if (mongoose.isValidObjectId(pid)) or.unshift({ _id: pid });
  return { $or: or };
}

function getBranchQty(mapLike, branchId) {
  if (!mapLike) return 0;
  if (typeof mapLike.get === 'function') return Number(mapLike.get(branchId) || 0);
  return Number(mapLike[branchId] || 0);
}
function setBranchQty(mapLike, branchId, qty) {
  if (!mapLike) return;
  if (typeof mapLike.set === 'function') {
    mapLike.set(branchId, qty);
  } else {
    mapLike[branchId] = qty;
  }
}

r.get('/', async (req, res) => {
  const rows = await Sale.find().sort({ created_at: -1 }).limit(500);
  res.json(rows);
});

r.post('/', requireRoleOrPerm(['Admin','Manager','Cashier'], 'add_sales'), async (req, res) => {
  const payload = req.body || {};
  const branchId = String(payload.branchId || '');
  if (!branchId) return res.status(400).json({ error: 'Missing branchId' });
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Sale must include items' });
  const clientId = String(payload.clientId || '').trim();
  if (clientId) {
    const existing = await Sale.findOne({ clientId });
    if (existing) return res.json(existing);
  }
  const cleaned = items.map(it => ({
    productId: it.productId,
    variantId: it.variantId || null,
    qty: Math.abs(Number(it.qty) || 0),
    sku: it.sku || '',
    name: it.name || ''
  }));
  if (cleaned.some(it => !it.productId || !Number.isFinite(it.qty) || it.qty <= 0)) {
    return res.status(400).json({ error: 'Each item must include productId and positive qty' });
  }

  let customerId = String(payload.customerId || '').trim();
  let customerCode = String(payload.customerCode || '').trim();
  let customerName = String(payload.customerName || '').trim();
  let customerPhone = String(payload.customerPhone || '').trim();
  if (customerId || customerCode) {
    let cust = null;
    if (customerId) {
      if (mongoose.isValidObjectId(customerId)) cust = await Customer.findById(customerId);
      else cust = await Customer.findOne({ clientId: customerId });
      customerId = cust ? String(cust._id) : '';
    } else {
      cust = await Customer.findOne({ customerCode });
      customerId = cust ? String(cust._id) : '';
    }
    if (!cust) return res.status(400).json({ error: 'Customer not found' });
    customerCode = String(cust.customerCode || customerCode || '');
    customerName = String(cust.name || customerName || '');
    customerPhone = String(cust.phone || customerPhone || '');
  } else {
    customerId = '';
    customerCode = '';
    customerName = '';
    customerPhone = '';
  }

  let branchCode = branchId;
  try {
    const b = await Branch.findOne({ id: branchId });
    if (b?.code) branchCode = b.code;
  } catch {}

  let invoiceNum = 1;
  let receiptNum = 1;
  let invoicePrefix = 'INV';
  let receiptPrefix = 'RCPT';
  let settingsData = {};
  try {
    const updated = await Settings.findOneAndUpdate(
      { key: 'default' },
      { $inc: { 'data.nextInvoiceNumber': 1, 'data.nextReceiptNumber': 1 } },
      { new: true, upsert: true }
    );
    settingsData = updated?.data || {};
    invoicePrefix = String(settingsData.invoicePrefix || 'INV');
    receiptPrefix = String(settingsData.receiptPrefix || 'RCPT');
    invoiceNum = Math.max(1, Number(settingsData.nextInvoiceNumber || 1) - 1);
    receiptNum = Math.max(1, Number(settingsData.nextReceiptNumber || 1) - 1);
  } catch {
    // keep defaults
  }

  const invoiceSerial = `${invoicePrefix}-${branchCode}-${String(invoiceNum).padStart(6,'0')}`;
  const receiptNumber = `${receiptPrefix}-${branchCode}-${String(receiptNum).padStart(6,'0')}`;

  const touched = [];
  let costTotal = 0;
  try {
    for (const it of cleaned) {
      const p = await Product.findOne(productLookupQuery(it.productId));
      if (!p) {
        const err = new Error(`Product not found: ${it.productId}`);
        err.status = 400;
        throw err;
      }
      if (it.variantId) {
        const idx = Array.isArray(p.variants) ? p.variants.findIndex(v => v.id === it.variantId) : -1;
        if (idx < 0) {
          const err = new Error(`Variant not found for product ${p.name}`);
          err.status = 400;
          throw err;
        }
        const v = p.variants[idx];
        if (!v.stockByBranch) v.stockByBranch = new Map();
        const prev = getBranchQty(v.stockByBranch, branchId);
        if (prev < it.qty) {
          const err = new Error(`Insufficient stock for ${p.name} (${v.label}) at ${branchCode}`);
          err.status = 400;
          throw err;
        }
        touched.push({ p, kind: 'variant', idx, branchId, prev });
        setBranchQty(v.stockByBranch, branchId, Math.max(0, prev - it.qty));
        p.variants[idx] = v;
        p.markModified('variants');
        await p.save();
      } else {
        if (!p.stockByBranch) p.stockByBranch = new Map();
        const prev = getBranchQty(p.stockByBranch, branchId);
        if (prev < it.qty) {
          const err = new Error(`Insufficient stock for ${p.name} at ${branchCode}`);
          err.status = 400;
          throw err;
        }
        touched.push({ p, kind: 'base', branchId, prev });
        setBranchQty(p.stockByBranch, branchId, Math.max(0, prev - it.qty));
        p.markModified('stockByBranch');
        await p.save();
      }
      const cp = Number(p.costPrice || 0);
      if (Number.isFinite(cp) && cp > 0) costTotal += cp * it.qty;
    }
  } catch (e) {
    try {
      for (let i = touched.length - 1; i >= 0; i--) {
        const t = touched[i];
        if (t.kind === 'variant') {
          const v = t.p.variants[t.idx];
          if (!v.stockByBranch) v.stockByBranch = new Map();
          setBranchQty(v.stockByBranch, t.branchId, t.prev);
          t.p.variants[t.idx] = v;
          t.p.markModified('variants');
        } else {
          if (!t.p.stockByBranch) t.p.stockByBranch = new Map();
          setBranchQty(t.p.stockByBranch, t.branchId, t.prev);
          t.p.markModified('stockByBranch');
        }
        await t.p.save();
      }
    } catch {}
    return res.status(e?.status || 500).json({ error: e?.message || 'Failed to apply sale stock changes' });
  }

  let sale;
  let customerPointsAfter = null;
  try {
    const revenueTotal = Number(payload.total || 0);
    const profitTotal = revenueTotal - Number(costTotal || 0);
    const loyaltyEnabled = !!settingsData.loyaltyEnabled;
    const earnAmount = Number(settingsData.loyaltyEarnAmount || 0);
    const earnPoints = Number(settingsData.loyaltyEarnPoints || 0);
    const redeemValue = Number(settingsData.loyaltyRedeemValue || 0);
    const minRedeemPoints = Math.max(0, Number(settingsData.loyaltyMinRedeemPoints || 0));
    const maxRedeemPercent = Math.max(0, Math.min(100, Number(settingsData.loyaltyMaxRedeemPercent ?? 50)));

    const earned = (loyaltyEnabled && earnAmount > 0 && earnPoints > 0)
      ? Math.max(0, Math.floor(revenueTotal / earnAmount) * earnPoints)
      : 0;

    let redeemed = 0;
    let loyaltyDiscount = 0;
    if (loyaltyEnabled && customerId) {
      const reqRedeemed = Math.max(0, Math.floor(Number(payload.loyaltyPointsRedeemed || 0)));
      if (reqRedeemed > 0) {
        if (reqRedeemed < minRedeemPoints) return res.status(400).json({ error: `Minimum redeem is ${minRedeemPoints} point(s)` });
        const cust = await Customer.findById(customerId);
        if (!cust) return res.status(400).json({ error: 'Customer not found' });
        const bal = Math.max(0, Math.floor(Number(cust.loyaltyPoints || 0)));
        redeemed = Math.min(reqRedeemed, bal);
        loyaltyDiscount = Math.max(0, redeemed * (Number.isFinite(redeemValue) ? redeemValue : 0));
        const cap = revenueTotal * (maxRedeemPercent / 100);
        if (loyaltyDiscount > cap) {
          loyaltyDiscount = cap;
          redeemed = redeemValue > 0 ? Math.floor(loyaltyDiscount / redeemValue) : 0;
        }
        const disc = Number(payload.discount || 0);
        if (disc + 0.0001 < loyaltyDiscount) return res.status(400).json({ error: 'Discount is less than loyalty discount' });
      }
    }

    sale = await Sale.create({
      ...payload,
      items: cleaned,
      customerId: customerId || undefined,
      customerCode: customerCode || undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      invoiceSerial,
      receiptNumber,
      costTotal: Number(costTotal || 0),
      profitTotal: Number(profitTotal || 0),
      loyaltyPointsEarned: earned,
      loyaltyPointsRedeemed: redeemed,
      loyaltyDiscount: loyaltyDiscount
    });
    if (loyaltyEnabled && customerId && (earned !== 0 || sale.loyaltyPointsRedeemed !== 0)) {
      const updated = await Customer.findByIdAndUpdate(
        customerId,
        { $inc: { loyaltyPoints: Number(earned || 0) - Number(sale.loyaltyPointsRedeemed || 0) } },
        { new: true }
      );
      customerPointsAfter = updated ? Number(updated.loyaltyPoints || 0) : null;
    }
  } catch (e) {
    try {
      for (let i = touched.length - 1; i >= 0; i--) {
        const t = touched[i];
        if (t.kind === 'variant') {
          const v = t.p.variants[t.idx];
          if (!v.stockByBranch) v.stockByBranch = new Map();
          setBranchQty(v.stockByBranch, t.branchId, t.prev);
          t.p.variants[t.idx] = v;
          t.p.markModified('variants');
        } else {
          if (!t.p.stockByBranch) t.p.stockByBranch = new Map();
          setBranchQty(t.p.stockByBranch, t.branchId, t.prev);
          t.p.markModified('stockByBranch');
        }
        await t.p.save();
      }
    } catch {}
    return res.status(500).json({ error: 'Failed to create sale' });
  }

  await Audit.create({
    actor: sale.sellerName || 'unknown',
    actionType: 'stock_sale_deduct',
    details: { items: sale.items.map(i => ({ sku: i.sku, qty: i.qty, productId: i.productId || null, variantId: i.variantId || null })), invoiceSerial, receiptNumber },
    branchId: sale.branchId,
    ts: new Date()
  });
  try {
    await ServerLog.create({
      level: 'info',
      actor: sale.sellerName || req.user?.name || 'unknown',
      route: '/api/sales',
      method: 'POST',
      status: 200,
      message: `Sale ${sale._id}: ${Array.isArray(sale.items) ? sale.items.map(i => `${i.sku || i.productId} x${i.qty}`).join(', ') : 'items'} @ ${sale.branchId}`,
      details: { invoiceSerial, receiptNumber }
    });
  } catch {}
  const out = sale?.toObject ? sale.toObject() : sale;
  if (customerPointsAfter != null) out.customerPointsAfter = customerPointsAfter;
  res.json(out);
});

export default r;
