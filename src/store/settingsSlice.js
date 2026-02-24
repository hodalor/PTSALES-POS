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
  drawerOpenOnCash: false,
  taxRate: 0.10,
  currencyCode: 'GHS',
  currencySymbol: '₵',
  currencyPosition: 'prefix'
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
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
    }
  }
});

export const { setAppName, setFooterText, setCurrentBranch, setReceiptLogoUrl, setReceiptHeader, setReceiptFooter, setBusinessPhone, setBusinessWebsite, setBusinessTpin, setSdcId, setReceiptQrBaseUrl, setInvoicePrefix, setNextInvoiceNumber, setDrawerOpenOnCash, setTaxRate, setCurrencyCode, setCurrencySymbol, setCurrencyPosition } = settingsSlice.actions;
export default settingsSlice.reducer;
