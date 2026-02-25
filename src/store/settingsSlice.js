import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  appName: 'ptSales POS',
  footerText: '© ptSales',
  currentBranchId: 'main',
  receiptLogoUrl: '',
  receiptHeader: 'Thank you for shopping with us!',
  receiptFooter: 'No refunds without receipt',
  businessPhone: '0243984046',
  businessWebsite: '',
  businessTpin: '',
  sdcId: '',
  receiptQrBaseUrl: '',
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  receiptPrefix: 'RCPT',
  nextReceiptNumber: 1,
  drawerOpenOnCash: false,
  taxRate: 0.10,
  currencyCode: 'GHS',
  currencySymbol: '₵',
  currencyPosition: 'prefix',
  currencies: [
    { code: 'GHS', symbol: '₵', position: 'prefix' },
    { code: 'USD', symbol: '$', position: 'prefix' }
  ],
  activeCurrencyCode: 'GHS',
  refreshIntervalSec: 60,
  userGrants: {}
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setAllSettings(state, action) {
      const data = action.payload || {};
      Object.keys(data).forEach(k => {
        state[k] = data[k];
      });
    },
    setUserGrants(state, action) {
      const m = action.payload || {};
      state.userGrants = m;
    },
    setUserGrant(state, action) {
      const { username, grants } = action.payload || {};
      const name = String(username || '');
      if (!name) return;
      if (!Array.isArray(grants)) return;
      if (!state.userGrants) state.userGrants = {};
      state.userGrants[name] = grants.slice();
    },
    setAppName(state, action) {
      state.appName = action.payload;
    },
    setFooterText(state, action) {
      state.footerText = action.payload;
    },
    setCurrentBranch(state, action) {
      state.currentBranchId = action.payload;
    },
    setReceiptLogoUrl(state, action) {
      state.receiptLogoUrl = action.payload;
    },
    setReceiptHeader(state, action) {
      state.receiptHeader = action.payload;
    },
    setReceiptFooter(state, action) {
      state.receiptFooter = action.payload;
    },
    setBusinessPhone(state, action) {
      state.businessPhone = String(action.payload || '');
    },
    setBusinessWebsite(state, action) {
      state.businessWebsite = String(action.payload || '');
    },
    setBusinessTpin(state, action) {
      state.businessTpin = String(action.payload || '');
    },
    setSdcId(state, action) {
      state.sdcId = String(action.payload || '');
    },
    setReceiptQrBaseUrl(state, action) {
      state.receiptQrBaseUrl = String(action.payload || '');
    },
    setInvoicePrefix(state, action) {
      state.invoicePrefix = String(action.payload || 'INV');
    },
    setNextInvoiceNumber(state, action) {
      let v = Number(action.payload);
      if (!Number.isFinite(v) || v < 1) v = 1;
      state.nextInvoiceNumber = Math.floor(v);
    },
    setReceiptPrefix(state, action) {
      state.receiptPrefix = String(action.payload || 'RCPT');
    },
    setNextReceiptNumber(state, action) {
      let v = Number(action.payload);
      if (!Number.isFinite(v) || v < 1) v = 1;
      state.nextReceiptNumber = Math.floor(v);
    },
    setReceiptPrefix(state, action) {
      state.receiptPrefix = String(action.payload || 'RCPT');
    },
    setNextReceiptNumber(state, action) {
      let v = Number(action.payload);
      if (!Number.isFinite(v) || v < 1) v = 1;
      state.nextReceiptNumber = Math.floor(v);
    },
    setDrawerOpenOnCash(state, action) {
      state.drawerOpenOnCash = !!action.payload;
    },
    setTaxRate(state, action) {
      let v = Number(action.payload);
      if (Number.isNaN(v)) v = 0;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      state.taxRate = v;
    },
    setCurrencyCode(state, action) {
      state.currencyCode = String(action.payload || '').toUpperCase() || 'GHS';
    },
    setCurrencySymbol(state, action) {
      state.currencySymbol = String(action.payload || '₵');
    },
    setCurrencyPosition(state, action) {
      const v = String(action.payload || 'prefix');
      state.currencyPosition = (v === 'suffix') ? 'suffix' : 'prefix';
    },
    addCurrency(state, action) {
      const { code, symbol, position } = action.payload || {};
      const c = String(code || '').toUpperCase();
      if (!c) return;
      const pos = position === 'suffix' ? 'suffix' : 'prefix';
      const idx = Array.isArray(state.currencies) ? state.currencies.findIndex(x => x.code === c) : -1;
      const entry = { code: c, symbol: String(symbol || ''), position: pos };
      if (idx >= 0) state.currencies[idx] = entry;
      else state.currencies.push(entry);
    },
    removeCurrency(state, action) {
      const c = String(action.payload || '').toUpperCase();
      state.currencies = (state.currencies || []).filter(x => x.code !== c);
      if (state.activeCurrencyCode === c) {
        const fallback = state.currencies[0] || { code: 'GHS', symbol: '₵', position: 'prefix' };
        state.activeCurrencyCode = fallback.code;
        state.currencyCode = fallback.code;
        state.currencySymbol = fallback.symbol;
        state.currencyPosition = fallback.position;
      }
    },
    setActiveCurrency(state, action) {
      const c = String(action.payload || '').toUpperCase();
      const found = (state.currencies || []).find(x => x.code === c);
      if (!found) return;
      state.activeCurrencyCode = found.code;
      state.currencyCode = found.code;
      state.currencySymbol = found.symbol;
      state.currencyPosition = found.position;
    },
    setRefreshIntervalSec(state, action) {
      let v = Number(action.payload);
      if (!Number.isFinite(v) || v < 10) v = 10;
      if (v > 3600) v = 3600;
      state.refreshIntervalSec = Math.floor(v);
    }
  }
});

export const { setAllSettings, setUserGrants, setUserGrant, setAppName, setFooterText, setCurrentBranch, setReceiptLogoUrl, setReceiptHeader, setReceiptFooter, setBusinessPhone, setBusinessWebsite, setBusinessTpin, setSdcId, setReceiptQrBaseUrl, setInvoicePrefix, setNextInvoiceNumber, setReceiptPrefix, setNextReceiptNumber, setDrawerOpenOnCash, setTaxRate, setCurrencyCode, setCurrencySymbol, setCurrencyPosition, addCurrency, removeCurrency, setActiveCurrency, setRefreshIntervalSec } = settingsSlice.actions;
export default settingsSlice.reducer;
