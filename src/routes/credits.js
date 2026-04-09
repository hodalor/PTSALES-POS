import { Router } from 'express';
import mongoose from 'mongoose';
import CreditRepayment from '../models/CreditRepayment.js';
import CreditSale from '../models/CreditSale.js';
import Customer from '../models/Customer.js';
import { requireAuth, requireRoleOrPerm } from '../middleware/auth.js';
import { createApprovalForReference } from '../utils/approvalWorkflow.js';
import { refreshCreditSaleStatus, updateCustomerCreditMetrics } from '../utils/credit.js';

const r = Router();

r.use(requireAuth);

r.get('/sales', async (req, res) => {
  const query = {};
  if (req.query.customerId) query.customer_id = String(req.query.customerId);
  if (req.query.status) query.status = String(req.query.status);
  const rows = await CreditSale.find(query).sort({ createdAt: -1 }).limit(500);
  const refreshed = [];
  for (const row of rows) refreshed.push(await refreshCreditSaleStatus(row));
  res.json(refreshed);
});

r.get('/repayments', async (req, res) => {
  const query = {};
  if (req.query.customerId) query.customerId = String(req.query.customerId);
  if (req.query.status) query.status = String(req.query.status);
  const rows = await CreditRepayment.find(query).sort({ createdAt: -1 }).limit(500);
  res.json(rows);
});

r.get('/customers/:id/summary', async (req, res) => {
  const customerId = String(req.params.id || '');
  let customer = null;
  if (mongoose.isValidObjectId(customerId)) customer = await Customer.findById(customerId);
  if (!customer) customer = await Customer.findOne({ $or: [{ clientId: customerId }, { customerCode: customerId }] });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const data = await updateCustomerCreditMetrics(String(customer._id));
  res.json(data);
});

r.get('/customers', async (_req, res) => {
  const customers = await Customer.find().sort({ name: 1 }).limit(500);
  const out = [];
  for (const customer of customers) {
    const summary = await updateCustomerCreditMetrics(String(customer._id));
    out.push(summary?.customer || customer);
  }
  res.json(out);
});

r.post('/repayments', requireRoleOrPerm(['Admin', 'Manager', 'Cashier'], 'add_sales'), async (req, res) => {
  const body = req.body || {};
  const creditSaleId = String(body.creditSaleId || '');
  const amount = Math.max(0, Number(body.amount || 0));
  if (!creditSaleId) return res.status(400).json({ error: 'Missing creditSaleId' });
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
  const creditSale = await CreditSale.findById(creditSaleId);
  if (!creditSale) return res.status(404).json({ error: 'Credit sale not found' });
  await refreshCreditSaleStatus(creditSale);
  if (String(creditSale.status || '') === 'completed') return res.status(400).json({ error: 'Credit sale is already completed' });
  const repayment = await CreditRepayment.create({
    creditSaleId: String(creditSale._id),
    customerId: String(creditSale.customer_id),
    amount,
    remark: String(body.remark || ''),
    initiatedByName: req.user?.name || 'unknown',
    initiatedByRole: req.user?.role || '',
    status: 'pending_director'
  });
  const approval = await createApprovalForReference({
    actionType: 'credit_repayment',
    referenceModel: 'CreditRepayment',
    referenceId: String(repayment._id),
    initiatedByName: req.user?.name || 'unknown',
    initiatedByRole: req.user?.role || ''
  });
  const fresh = await CreditRepayment.findById(repayment._id);
  res.json({ repayment: fresh, approval });
});

export default r;
