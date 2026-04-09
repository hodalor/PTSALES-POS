import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { approveApproval, listApprovals, rejectApproval } from '../api/approvals';
import { useToast } from '../components/ToastProvider';
import { promptDialog } from '../utils/dialogs';

function EasyBuyRepaymentApprovalsPage() {
  const toast = useToast();
  const auth = useSelector(s => s.auth);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending_director');
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listApprovals(status === 'all' ? { actionType: 'credit_repayment' } : { actionType: 'credit_repayment', status });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.show(String(e?.message || 'Failed to load repayment approvals'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => { load(); }, [load]);

  async function onApprove(row) {
    const remark = await promptDialog('Approval remark');
    if (!remark || !String(remark).trim()) return;
    setWorkingId(row._id || '');
    try {
      await approveApproval(row._id, { remark, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '' });
      setRows(prev => prev.filter(item => String(item._id) !== String(row._id)));
      toast.show('Repayment approval updated', { type: 'success' });
      await load();
    } catch (e) {
      const msg = String(e?.message || '');
      if (/timed out/i.test(msg)) {
        await load();
        toast.show('Approval is processing. The list has been refreshed.', { type: 'success' });
      } else {
        toast.show(msg || 'Failed to approve', { type: 'error' });
      }
    } finally {
      setWorkingId('');
    }
  }

  async function onReject(row) {
    const reason = await promptDialog('Rejection reason');
    if (!reason || !String(reason).trim()) return;
    setWorkingId(row._id || '');
    try {
      await rejectApproval(row._id, { reason, approverName: auth.user?.name || 'unknown', approverRole: auth.role || '' });
      setRows(prev => prev.filter(item => String(item._id) !== String(row._id)));
      toast.show('Repayment approval rejected', { type: 'success' });
      await load();
    } catch (e) {
      const msg = String(e?.message || '');
      if (/timed out/i.test(msg)) {
        await load();
        toast.show('Rejection is processing. The list has been refreshed.', { type: 'success' });
      } else {
        toast.show(msg || 'Failed to reject', { type: 'error' });
      }
    } finally {
      setWorkingId('');
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>EasyBuy Repayment Approvals</h1>
          <div style={{ color: '#64748b', fontSize: 13 }}>Director and manager approvals for repayment requests.</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={status === 'pending_director' ? 'btn btn-primary' : 'btn'} onClick={() => setStatus('pending_director')}>Pending Director</button>
          <button className={status === 'pending_manager' ? 'btn btn-primary' : 'btn'} onClick={() => setStatus('pending_manager')}>Pending Manager</button>
          <button className={status === 'approved' ? 'btn btn-primary' : 'btn'} onClick={() => setStatus('approved')}>Approved</button>
          <button className={status === 'rejected' ? 'btn btn-primary' : 'btn'} onClick={() => setStatus('rejected')}>Rejected</button>
        </div>
      </div>
      <div className="card">
        {loading && <div style={{ padding: 12, color: '#64748b' }}>Loading approvals…</div>}
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th align="left">Action</th>
                <th align="left">Status</th>
                <th align="left">Initiated By</th>
                <th align="left">Created</th>
                <th align="left"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row._id}>
                  <td>{row.actionType}</td>
                  <td>{row.status}</td>
                  <td>{row.initiatedByName || '—'} {row.initiatedByRole ? `(${row.initiatedByRole})` : ''}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                  <td>
                    {(row.status === 'pending_director' || row.status === 'pending_manager') ? (
                      <>
                        <button className="btn btn-primary" onClick={() => onApprove(row)} disabled={workingId === row._id}>{workingId === row._id ? 'Working…' : 'Approve'}</button>
                        <button className="btn" onClick={() => onReject(row)} disabled={workingId === row._id} style={{ marginLeft: 6 }}>{workingId === row._id ? 'Working…' : 'Reject'}</button>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan="5" style={{ padding: 12, color: '#64748b' }}>No repayment approvals found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EasyBuyRepaymentApprovalsPage;
