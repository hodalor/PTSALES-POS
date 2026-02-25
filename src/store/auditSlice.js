import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  entries: []
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    setEntries(state, action) {
      state.entries = Array.isArray(action.payload) ? action.payload : [];
    },
    addAudit(state, action) {
      const { actor, actionType, details, remark, branchId } = action.payload || {};
      state.entries.push({
        id: nanoid(),
        ts: new Date().toISOString(),
        actor: actor || 'unknown',
        actionType,
        details: details || null,
        remark: remark || '',
        branchId: branchId || null
      });
    },
    clearAudit(state) {
      state.entries = [];
    }
  }
});

export const { setEntries, addAudit, clearAudit } = auditSlice.actions;
export default auditSlice.reducer;
