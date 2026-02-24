import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  discount: 0,
  notes: ''
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: {
      reducer(state, action) {
        const existing = state.items.find(i => i.sku === action.payload.sku);
        if (existing) {
          existing.quantity += action.payload.quantity || 1;
        } else {
          state.items.push({ id: nanoid(), ...action.payload, quantity: action.payload.quantity || 1 });
        }
      },
      prepare(payload) {
        return { payload };
      }
    },
    removeItem(state, action) {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    setQuantity(state, action) {
      const { id, quantity } = action.payload;
      const item = state.items.find(i => i.id === id);
      if (item) item.quantity = quantity;
    },
    clearCart(state) {
      state.items = [];
      state.discount = 0;
      state.notes = '';
    },
    setDiscount(state, action) {
      state.discount = action.payload || 0;
    },
    setNotes(state, action) {
      state.notes = action.payload || '';
    }
  }
});

export const { addItem, removeItem, setQuantity, clearCart, setDiscount, setNotes } = cartSlice.actions;
export default cartSlice.reducer;
