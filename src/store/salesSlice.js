import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  sales: []
};

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    setSales(state, action) {
      state.sales = Array.isArray(action.payload) ? action.payload : [];
    },
    recordSale: {
      reducer(state, action) {
        state.sales.push(action.payload);
      },
      prepare(sale) {
        return { payload: { id: nanoid(), ...sale } };
      }
    }
  }
});

export const { setSales, recordSale } = salesSlice.actions;
export default salesSlice.reducer;
