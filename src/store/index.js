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
import { loadState, saveState } from './persist';

const preloadedState = loadState();
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
    sessions: sessionsReducer
  },
  preloadedState
});

store.subscribe(() => {
  saveState(store.getState());
});

try {
  const st = store.getState();
  const list = st.users?.users || [];
  const su = list.find(u => String(u.name || '').toLowerCase() === 'superadmin');
  if (su) {
    const patch = { id: su.id };
    let needs = false;
    if (su.role !== 'SuperAdmin') { patch.role = 'SuperAdmin'; needs = true; }
    if (su.assignedBranches !== 'all') { patch.assignedBranches = 'all'; needs = true; }
    if (typeof su.active === 'undefined') { patch.active = true; needs = true; }
    if (needs) store.dispatch(updateUser(patch));
    // remove duplicate "superadmin" records beyond the first
    const dups = list.filter(u => String(u.name || '').toLowerCase() === 'superadmin' && u.id !== su.id);
    dups.forEach(d => store.dispatch(removeUser(d.id)));
  } else {
    store.dispatch(addUser({ name: 'superadmin', role: 'SuperAdmin', pin: '1234', branchId: 'main', assignedBranches: 'all' }));
  }
} catch {}

export default store;
