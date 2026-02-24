import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  branches: [
    { id: 'main', name: 'Main Branch', code: 'MAIN' }
  ]
};

const branchesSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
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

export const { addBranch, updateBranch, removeBranch } = branchesSlice.actions;
export default branchesSlice.reducer;
