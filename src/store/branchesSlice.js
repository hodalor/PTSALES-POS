import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  branches: []
};

const branchesSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
    setBranches(state, action) {
      state.branches = Array.isArray(action.payload) && action.payload.length > 0 ? action.payload : state.branches;
    },
    addBranch: {
      reducer(state, action) {
        state.branches.push(action.payload);
      },
      prepare({ name, code }) {
        return { payload: { id: nanoid(), name, code } };
      }
    },
    updateBranch(state, action) {
      const { id, name, code } = action.payload;
      const b = state.branches.find(x => x.id === id);
      if (b) {
        b.name = name;
        b.code = code;
      }
    },
    removeBranch(state, action) {
      state.branches = state.branches.filter(b => b.id !== action.payload);
    }
  }
});

export const { setBranches, addBranch, updateBranch, removeBranch } = branchesSlice.actions;
export default branchesSlice.reducer;
