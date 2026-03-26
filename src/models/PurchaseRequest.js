import mongoose from 'mongoose';

const PurchaseRequestSchema = new mongoose.Schema({
  clientId: { type: String, unique: true, sparse: true, index: true },
  productId: String,
  variantId: String,
  branchId: String,
  baseUnits: Number,
  pack: String,
  supplier: String,
  cost: Number,
  costPerUnit: Number,
  expiryDate: Date,
  remark: String,
  initiatorName: String,
  initiatorRole: String,
  status: { type: String, default: 'pending_approval' },
  approverName: String,
  approverRole: String,
  approvalRemark: String,
  rejectionRemark: String,
  approved_at: Date,
  rejected_at: Date
}, { timestamps: true });

export default mongoose.model('PurchaseRequest', PurchaseRequestSchema);
