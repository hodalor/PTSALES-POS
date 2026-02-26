import mongoose from 'mongoose';

const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: String,
  phone: String,
  email: String
}, { timestamps: true });

export default mongoose.model('Supplier', SupplierSchema);
