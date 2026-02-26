import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  customers: []
};

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setCustomers(state, action) {
      const list = Array.isArray(action.payload) ? action.payload : [];
      state.customers = list.map(c => {
        const id = c?.id || c?._id || nanoid();
        return { ...c, id: String(id) };
      });
    },
    addCustomer(state, action) {
      const c = action.payload || {};
      const id = c?.id || c?._id || nanoid();
      state.customers.unshift({ ...c, id: String(id) });
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
