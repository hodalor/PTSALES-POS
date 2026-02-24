import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  users: [
    { id: 'u1', name: 'superadmin', role: 'SuperAdmin', pin: '1234', branchId: 'main', assignedBranches: 'all', active: true }
  ],
  roles: ['SuperAdmin', 'Admin', 'Branch Manager', 'Manager', 'Cashier', 'Inventory Staff', 'Auditor', 'Other']
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    addUser: {
      reducer(state, action) {
        state.users.push(action.payload);
      },
      prepare({ name, role, pin, branchId, assignedBranches }) {
        let assigned = assignedBranches;
        if (assigned === undefined) assigned = branchId ? [branchId] : [];
        if (assigned !== 'all' && !Array.isArray(assigned)) assigned = [assigned];
        const payload = { id: nanoid(), name, role, pin, branchId, assignedBranches: assigned, active: true };
        return { payload };
      }
    },
    updateUser(state, action) {
      const u = state.users.find(x => x.id === action.payload.id);
      if (u) Object.assign(u, action.payload);
    },
    removeUser(state, action) {
      state.users = state.users.filter(u => u.id !== action.payload);
    }
  }
});

export const { addUser, updateUser, removeUser } = usersSlice.actions;
export default usersSlice.reducer;
