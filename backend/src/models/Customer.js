import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  email: String
}, { timestamps: true });

export default mongoose.model('Customer', CustomerSchema);
