import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  customers: []
};

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setCustomers(state, action) {
      state.customers = Array.isArray(action.payload) ? action.payload : [];
    },
    addCustomer: {
      reducer(state, action) {
        state.customers.push(action.payload);
      },
      prepare(data) {
        const id = nanoid();
        const now = new Date().toISOString();
        return { payload: { id, name: '', phone: '', email: '', address: '', notes: '', loyalty: 0, credit: 0, active: true, createdAt: now, ...data } };
      }
    },
    updateCustomer(state, action) {
      const { id, ...patch } = action.payload || {};
      const idx = state.customers.findIndex(c => c.id === id);
      if (idx >= 0) {
        state.customers[idx] = { ...state.customers[idx], ...patch };
      }
    },
    removeCustomer(state, action) {
      const id = action.payload;
      state.customers = state.customers.filter(c => c.id !== id);
    }
  }
});

export const { setCustomers, addCustomer, updateCustomer, removeCustomer } = customersSlice.actions;
export default customersSlice.reducer;
