import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  sales: []
};

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    setSales(state, action) {
      const list = Array.isArray(action.payload) ? action.payload : [];
      const server = list.map(s => {
        const id = s?.id || s?._id || nanoid();
        return { ...s, id: String(id) };
      });
      const offline = state.sales.filter(s => s && s.offline);
      state.sales = server.concat(offline);
    },
    recordSale: {
      reducer(state, action) {
        state.sales.push(action.payload);
      },
      prepare(sale) {
        const id = sale?.id || sale?._id || nanoid();
        return { payload: { ...sale, id: String(id) } };
      }
    }
  }
});

export const { setSales, recordSale } = salesSlice.actions;
export default salesSlice.reducer;
