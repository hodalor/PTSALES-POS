import mongoose from 'mongoose';

const TransferRequestSchema = new mongoose.Schema({
  clientId: { type: String, unique: true, sparse: true, index: true },
  productId: String,
  variantId: String,
  from: String,
  to: String,
  qty: Number,
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

TransferRequestSchema.index({ to: 1, status: 1, createdAt: -1 });
TransferRequestSchema.index({ clientId: 1 }, { unique: true, sparse: true });

export default mongoose.model('TransferRequest', TransferRequestSchema);
