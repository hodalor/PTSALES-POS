import mongoose from 'mongoose';

const SaleItemSchema = new mongoose.Schema({
  productId: String,
  sku: String,
  name: String,
  variantId: String,
  spec: String,
  qty: Number,
  price: Number
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  type: String,
  amount: Number
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  branchId: { type: String, required: true },
  sellerName: { type: String },
  items: { type: [SaleItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  costTotal: { type: Number, default: 0 },
  profitTotal: { type: Number, default: 0 },
  invoiceSerial: { type: String },
  receiptNumber: { type: String },
  payment_methods: { type: [PaymentSchema], default: [] },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

SaleSchema.index({ created_at: -1 });

export default mongoose.model('Sale', SaleSchema);
