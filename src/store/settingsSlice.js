import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  appName: 'ptSales POS',
  footerText: '© ptSales',
  currentBranchId: 'main',
  receiptLogoUrl: '',
  receiptHeader: 'Thank you for shopping with us!',
  receiptFooter: 'No refunds without receipt',
  drawerOpenOnCash: false,
  taxRate: 0.10
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
    setDrawerOpenOnCash(state, action) {
      state.drawerOpenOnCash = !!action.payload;
    },
    setTaxRate(state, action) {
      let v = Number(action.payload);
      if (Number.isNaN(v)) v = 0;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      state.taxRate = v;
    }
  }
});

export const { setAppName, setFooterText, setCurrentBranch, setReceiptLogoUrl, setReceiptHeader, setReceiptFooter, setDrawerOpenOnCash, setTaxRate } = settingsSlice.actions;
export default settingsSlice.reducer;
