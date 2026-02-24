import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOpen: false,
  openedAt: null,
  closedAt: null,
  openingFloat: 0,
  movements: [] // {time, type: 'in'|'out', amount, note}
};

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    openSession(state, action) {
      if (state.isOpen) return;
      state.isOpen = true;
      state.openedAt = new Date().toISOString();
      state.closedAt = null;
      state.openingFloat = Number(action.payload || 0);
      state.movements = [];
    },
    closeSession(state) {
      if (!state.isOpen) return;
      state.isOpen = false;
      state.closedAt = new Date().toISOString();
    },
    addMovement(state, action) {
      if (!state.isOpen) return;
      const { type, amount, note } = action.payload;
      state.movements.push({ time: new Date().toISOString(), type, amount: Number(amount), note });
    }
  }
});

export const { openSession, closeSession, addMovement } = sessionsSlice.actions;
export default sessionsSlice.reducer;
