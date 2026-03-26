import mongoose from 'mongoose';

const AdjustmentRequestSchema = new mongoose.Schema({
  clientId: { type: String, unique: true, sparse: true, index: true },
  productId: String,
  variantId: String,
  branchId: String,
  delta: Number,
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

AdjustmentRequestSchema.index({ branchId: 1, status: 1, createdAt: -1 });
AdjustmentRequestSchema.index({ clientId: 1 }, { unique: true, sparse: true });

export default mongoose.model('AdjustmentRequest', AdjustmentRequestSchema);
