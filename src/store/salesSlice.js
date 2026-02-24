import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  sales: []
};

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
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

export const { recordSale } = salesSlice.actions;
export default salesSlice.reducer;
