import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  stockByBranch: { type: Map, of: Number, default: {} }
}, { _id: false });

const PackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true }
}, { _id: false });

const AttrSchema = new mongoose.Schema({
  key: String,
  value: String
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  id: { type: String, index: true },
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  price: { type: Number, required: true, default: 0 },
  category: { type: String },
  barcode: { type: String },
  image: { type: String },
  lowStock: { type: Number, default: 0 },
  unitKind: { type: String, default: 'none' },
  unitValue: { type: Number },
  unitSymbol: { type: String },
  sizeLabel: { type: String },
  shoeSize: { type: String },
  attributes: { type: [AttrSchema], default: [] },
  packs: { type: [PackSchema], default: [] },
  variants: { type: [VariantSchema], default: [] },
  stockByBranch: { type: Map, of: Number, default: {} }
}, { timestamps: true, toJSON: { flattenMaps: true }, toObject: { flattenMaps: true } });

export default mongoose.model('Product', ProductSchema);
