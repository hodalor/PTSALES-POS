import { createSlice, nanoid } from '@reduxjs/toolkit';

function pad12Digits(n) {
  const s = String(n).replace(/\D/g, '');
  if (s.length >= 12) return s.slice(-12);
  return (s + '000000000000').slice(0, 12);
}

function ean13CheckDigit(d12) {
  // d12 is a 12-digit numeric string
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(d12[i]);
    sum += (i % 2 === 0) ? d : d * 3;
  }
  const mod = sum % 10;
  return String((10 - mod) % 10);
}

function generateEAN13() {
  const base = pad12Digits(String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));
  return base + ean13CheckDigit(base);
}

const initialState = {
  products: [
    { id: 'p1', name: 'Soda', sku: 'SODA-330', price: 10, stockByBranch: { main: 50 }, category: 'Beverages', barcode: generateEAN13(), lowStock: 10, image: null, unitKind: 'volume', unitValue: 330, unitSymbol: 'mL', attributes: [], packs: [{ name: 'Case (24)', quantity: 24 }] }
  ],
  categories: ['Beverages']
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    addProduct: {
      reducer(state, action) {
        state.products.push(action.payload);
      },
      prepare(product) {
        const payload = { id: nanoid(), stockByBranch: {}, attributes: [], packs: [], unitKind: 'none', unitValue: null, unitSymbol: '', sizeLabel: '', shoeSize: '', ...product };
        if (!payload.barcode) {
          payload.barcode = generateEAN13();
        }
        return { payload };
      }
    },
    updateProduct(state, action) {
      const p = state.products.find(x => x.id === action.payload.id);
      if (p) {
        Object.assign(p, action.payload);
      }
    },
    removeProduct(state, action) {
      state.products = state.products.filter(p => p.id !== action.payload);
    },
    setStock(state, action) {
      const { productId, branchId, quantity, variantId } = action.payload;
      const p = state.products.find(x => x.id === productId);
      if (!p) return;
      if (variantId && Array.isArray(p.variants)) {
        const v = p.variants.find(vv => vv.id === variantId);
        if (!v) return;
        v.stockByBranch = v.stockByBranch || {};
        v.stockByBranch[branchId] = quantity;
        return;
      }
      p.stockByBranch = p.stockByBranch || {};
      p.stockByBranch[branchId] = quantity;
    },
    adjustStock(state, action) {
      const { productId, branchId, delta, variantId } = action.payload;
      const p = state.products.find(x => x.id === productId);
      if (!p) return;
      if (variantId && Array.isArray(p.variants)) {
        const v = p.variants.find(vv => vv.id === variantId);
        if (!v) return;
        v.stockByBranch = v.stockByBranch || {};
        const cur = v.stockByBranch[branchId] || 0;
        v.stockByBranch[branchId] = Math.max(0, cur + delta);
        return;
      }
      p.stockByBranch = p.stockByBranch || {};
      const cur = p.stockByBranch[branchId] || 0;
      p.stockByBranch[branchId] = Math.max(0, cur + delta);
    },
    addCategory(state, action) {
      if (!state.categories.includes(action.payload)) state.categories.push(action.payload);
    }
  }
});

export const { addProduct, updateProduct, removeProduct, setStock, adjustStock, addCategory } = productsSlice.actions;
export default productsSlice.reducer;
