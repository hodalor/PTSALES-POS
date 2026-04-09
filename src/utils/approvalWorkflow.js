import Audit from '../models/Audit.js';
import Approval from '../models/Approval.js';
import CreditRepayment from '../models/CreditRepayment.js';
import CreditSale from '../models/CreditSale.js';
import Product from '../models/Product.js';
import WholesaleOperation from '../models/WholesaleOperation.js';
import mongoose from 'mongoose';
import { getMapQty, getStockTarget, markInventoryModified, setMapQty } from './inventory.js';
import { refreshCreditSaleStatus, updateCustomerCreditMetrics } from './credit.js';

function productQuery(productId) {
  const pid = String(productId || '');
  const or = [{ id: pid }];
  if (mongoose.isValidObjectId(pid)) or.unshift({ _id: pid });
  return { $or: or };
}

export function canApproveDirector(user) {
  const role = String(user?.role || '').toLowerCase();
  const grants = Array.isArray(user?.grants) ? user.grants : [];
  return ['admin', 'superadmin', 'director'].includes(role) || grants.includes('approve_wholesale_director') || grants.includes('approve_credit_director');
}

export function canApproveManager(user) {
  const role = String(user?.role || '').toLowerCase();
  const grants = Array.isArray(user?.grants) ? user.grants : [];
  return ['manager', 'admin', 'superadmin'].includes(role) || grants.includes('approve_wholesale_manager') || grants.includes('approve_credit_manager');
}

async function applyWholesaleOperation(operation, actor) {
  const product = await Product.findOne(productQuery(operation.productId));
  if (!product) {
    const err = new Error('Product not found for wholesale operation');
    err.status = 400;
    throw err;
  }
  const qty = Math.max(0, Number(operation.qty || 0));
  if (qty <= 0) {
    const err = new Error('Quantity must be greater than zero');
    err.status = 400;
    throw err;
  }
  if (operation.operationType === 'purchase' || operation.operationType === 'refund') {
    const target = getStockTarget(product, operation.variantId, operation.toInventoryType || operation.fromInventoryType || 'wholesale');
    if (!target) {
      const err = new Error('Variant not found');
      err.status = 400;
      throw err;
    }
    const current = getMapQty(target.container, operation.branchId || operation.toBranchId);
    setMapQty(target.container, operation.branchId || operation.toBranchId, current + qty);
    markInventoryModified(target);
    await product.save();
  } else if (operation.operationType === 'adjustment') {
    const target = getStockTarget(product, operation.variantId, operation.fromInventoryType || 'wholesale');
    if (!target) {
      const err = new Error('Variant not found');
      err.status = 400;
      throw err;
    }
    const branchId = operation.branchId || operation.fromBranchId;
    const current = getMapQty(target.container, branchId);
    const delta = String(operation.adjustmentType || 'increase') === 'decrease' ? -qty : qty;
    if (current + delta < 0) {
      const err = new Error('Insufficient stock for adjustment');
      err.status = 400;
      throw err;
    }
    setMapQty(target.container, branchId, current + delta);
    markInventoryModified(target);
    await product.save();
  } else if (operation.operationType === 'transfer') {
    const fromTarget = getStockTarget(product, operation.variantId, operation.fromInventoryType || 'wholesale');
    const toTarget = getStockTarget(product, operation.variantId, operation.toInventoryType || 'wholesale');
    if (!fromTarget || !toTarget) {
      const err = new Error('Variant not found');
      err.status = 400;
      throw err;
    }
    const fromCurrent = getMapQty(fromTarget.container, operation.fromBranchId);
    if (fromCurrent < qty) {
      const err = new Error('Insufficient stock for transfer');
      err.status = 400;
      throw err;
    }
    const toCurrent = getMapQty(toTarget.container, operation.toBranchId);
    setMapQty(fromTarget.container, operation.fromBranchId, fromCurrent - qty);
    setMapQty(toTarget.container, operation.toBranchId, toCurrent + qty);
    markInventoryModified(fromTarget);
    markInventoryModified(toTarget);
    await product.save();
  }
  operation.status = 'approved';
  operation.executedAt = new Date();
  await operation.save();
  await Audit.create({
    actor: actor?.name || 'unknown',
    actionType: `wholesale_${operation.operationType}_approved`,
    details: {
      productId: operation.productId,
      variantId: operation.variantId || '',
      qty,
      branchId: operation.branchId || '',
      fromBranchId: operation.fromBranchId || '',
      toBranchId: operation.toBranchId || '',
      fromInventoryType: operation.fromInventoryType || '',
      toInventoryType: operation.toInventoryType || ''
    },
    branchId: operation.branchId || operation.toBranchId || operation.fromBranchId || '',
    ts: new Date()
  });
}

async function applyCreditRepayment(repayment, actor) {
  const creditSale = await CreditSale.findById(repayment.creditSaleId);
  if (!creditSale) {
    const err = new Error('Credit sale not found');
    err.status = 400;
    throw err;
  }
  const amount = Math.max(0, Number(repayment.amount || 0));
  if (amount <= 0) {
    const err = new Error('Repayment amount must be greater than zero');
    err.status = 400;
    throw err;
  }
  const fresh = await refreshCreditSaleStatus(creditSale);
  const balance = Math.max(0, Number(fresh.balance || 0) + Number(fresh.accumulated_penalty || 0));
  if (amount > balance) {
    const err = new Error('Repayment amount exceeds outstanding balance');
    err.status = 400;
    throw err;
  }
  const appliedToPenalty = Math.min(Number(fresh.accumulated_penalty || 0), amount);
  const principalPayment = amount - appliedToPenalty;
  fresh.accumulated_penalty = Math.max(0, Number(fresh.accumulated_penalty || 0) - appliedToPenalty);
  fresh.amount_paid = Math.max(0, Number(fresh.amount_paid || 0) + principalPayment);
  fresh.payment_history.push({
    amount,
    paid_at: new Date(),
    approved_by: actor?.name || 'unknown',
    note: repayment.remark || ''
  });
  await refreshCreditSaleStatus(fresh);
  repayment.status = 'approved';
  repayment.approvedByName = actor?.name || 'unknown';
  repayment.approvedByRole = actor?.role || '';
  repayment.approvedAt = new Date();
  await repayment.save();
  await updateCustomerCreditMetrics(repayment.customerId);
  await Audit.create({
    actor: actor?.name || 'unknown',
    actionType: 'credit_repayment_approved',
    details: { creditSaleId: repayment.creditSaleId, amount },
    branchId: fresh.branchId || '',
    ts: new Date()
  });
}

export async function executeApprovedReference(approval, actor) {
  if (!approval) return null;
  if (approval.referenceModel === 'WholesaleOperation') {
    const operation = await WholesaleOperation.findById(approval.referenceId);
    if (!operation) throw new Error('Wholesale operation not found');
    await applyWholesaleOperation(operation, actor);
  } else if (approval.referenceModel === 'CreditRepayment') {
    const repayment = await CreditRepayment.findById(approval.referenceId);
    if (!repayment) throw new Error('Credit repayment not found');
    await applyCreditRepayment(repayment, actor);
  } else {
    throw new Error('Unsupported approval reference');
  }
  approval.status = 'approved';
  approval.executedAt = new Date();
  await approval.save();
  return approval;
}

export async function syncReferenceStatus(referenceModel, referenceId, status, extra = {}) {
  if (referenceModel === 'WholesaleOperation') {
    await WholesaleOperation.findByIdAndUpdate(referenceId, { status, ...extra });
  } else if (referenceModel === 'CreditRepayment') {
    await CreditRepayment.findByIdAndUpdate(referenceId, { status, ...extra });
  }
}

export async function createApprovalForReference({
  actionType,
  referenceModel,
  referenceId,
  initiatedByName,
  initiatedByRole
}) {
  const approval = await Approval.create({
    actionType,
    referenceModel,
    referenceId,
    initiatedByName: initiatedByName || '',
    initiatedByRole: initiatedByRole || '',
    status: 'pending_director'
  });
  await syncReferenceStatus(referenceModel, referenceId, 'pending_director', { approvalId: String(approval._id) });
  return approval;
}
