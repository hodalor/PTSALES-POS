import mongoose from 'mongoose';

const WholesaleOperationSchema = new mongoose.Schema({
  clientId: { type: String, unique: true, sparse: true, index: true },
  operationType: {
    type: String,
    enum: ['purchase', 'transfer', 'adjustment', 'refund'],
    required: true,
    index: true
  },
  productId: { type: String, required: true },
  variantId: { type: String, default: '' },
  branchId: { type: String, default: '' },
  fromBranchId: { type: String, default: '' },
  toBranchId: { type: String, default: '' },
  fromInventoryType: { type: String, enum: ['retail', 'wholesale'], default: 'wholesale' },
  toInventoryType: { type: String, enum: ['retail', 'wholesale'], default: 'wholesale' },
  qty: { type: Number, required: true, min: 0 },
  cost: { type: Number, default: 0 },
  requestedAmount: { type: Number, default: 0 },
  adjustmentType: { type: String, enum: ['increase', 'decrease'], default: 'increase' },
  supplier: { type: String, default: '' },
  reason: { type: String, default: '' },
  remark: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending_director', 'pending_manager', 'approved', 'rejected'],
    default: 'pending_director',
    index: true
  },
  approvalId: { type: String, index: true },
  initiatedByName: { type: String, default: '' },
  initiatedByRole: { type: String, default: '' },
  executedAt: { type: Date }
}, { timestamps: true });

WholesaleOperationSchema.index({ operationType: 1, status: 1, createdAt: -1 });

export default mongoose.model('WholesaleOperation', WholesaleOperationSchema);
