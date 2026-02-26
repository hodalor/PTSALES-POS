import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema({
  customerCode: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  phone: { type: String, index: true },
  email: { type: String, index: true },
  dob: { type: Date },
  idCardNumber: { type: String, index: true },
  address: { type: String },
  photo: { type: String },
  vip: { type: Boolean, default: false },
  anniversaryDate: { type: Date },
  loyaltyPoints: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Customer', CustomerSchema);
