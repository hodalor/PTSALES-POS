import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  role: null,
  isAuthenticated: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action) {
      state.user = action.payload.user;
      state.role = action.payload.role;
      state.isAuthenticated = true;
    },
    logout(state) {
      state.user = null;
      state.role = null;
      state.isAuthenticated = false;
    }
  }
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
