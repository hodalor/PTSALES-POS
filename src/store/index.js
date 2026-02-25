import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import cartReducer from './cartSlice';
import settingsReducer from './settingsSlice';
import branchesReducer from './branchesSlice';
import productsReducer from './productsSlice';
import usersReducer, { updateUser, addUser, removeUser } from './usersSlice';
import suppliersReducer from './suppliersSlice';
import customersReducer from './customersSlice';
import salesReducer from './salesSlice';
import sessionsReducer from './sessionsSlice';
import auditReducer from './auditSlice';
import refundsReducer from './refundsSlice';
// persistence disabled

const preloadedState = undefined;
const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    settings: settingsReducer,
    branches: branchesReducer,
    products: productsReducer,
    users: usersReducer,
    suppliers: suppliersReducer,
    customers: customersReducer,
    sales: salesReducer,
    audit: auditReducer,
    sessions: sessionsReducer,
    refunds: refundsReducer
  },
  preloadedState
});

// no-op persistence

// removed client-side superadmin seeding

export default store;
