import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  requests: []
};

const refundsSlice = createSlice({
  name: 'refunds',
  initialState,
  reducers: {
    setRequests(state, action) {
      state.requests = Array.isArray(action.payload) ? action.payload : [];
    },
    createRefundRequest: {
      reducer(state, action) {
        state.requests.push(action.payload);
      },
      prepare(req) {
        return {
          payload: {
            id: nanoid(),
            status: 'pending_approval',
            created_at: new Date().toISOString(),
            ...req
          }
        };
      }
    },
    approveRefund(state, action) {
      const { id, approverName, approverRole, approvalRemark, restockChoice, restockMode, restockItems } = action.payload || {};
      const r = state.requests.find(x => x.id === id && x.status === 'pending_approval');
      if (r) {
        r.status = 'approved';
        r.approved_at = new Date().toISOString();
        r.approverName = approverName || 'unknown';
        r.approverRole = approverRole || '';
        if (typeof restockMode === 'string') {
          r.restockMode = restockMode; // 'none' | 'full' | 'partial'
          r.usedRestock = restockMode !== 'none';
        } else {
          r.usedRestock = typeof restockChoice === 'boolean' ? restockChoice : !!r.restock;
          r.restockMode = r.usedRestock ? 'full' : 'none';
        }
        if (Array.isArray(restockItems)) {
          r.restockItems = restockItems.map(x => ({ sku: x.sku, qty: Number(x.qty) || 0 }));
        }
        if (typeof approvalRemark === 'string') r.approvalRemark = approvalRemark;
      }
    },
    rejectRefund(state, action) {
      const { id, approverName, approverRole, remark } = action.payload || {};
      const r = state.requests.find(x => x.id === id && x.status === 'pending_approval');
      if (r) {
        r.status = 'rejected';
        r.rejected_at = new Date().toISOString();
        r.approverName = approverName || 'unknown';
        r.approverRole = approverRole || '';
        r.rejectionRemark = remark || '';
      }
    }
  }
});

export const { setRequests, createRefundRequest, approveRefund, rejectRefund } = refundsSlice.actions;
export default refundsSlice.reducer;
