import { useDispatch, useSelector } from 'react-redux';
import { setAppName, setFooterText, setCurrentBranch, setReceiptHeader, setReceiptFooter, setDrawerOpenOnCash, setTaxRate } from '../store/settingsSlice';
import { addBranch, removeBranch } from '../store/branchesSlice';
import { useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import { addAudit } from '../store/auditSlice';

function ConfigSettingsPage() {
  const dispatch = useDispatch();
  const settings = useSelector(s => s.settings);
  const branches = useSelector(s => s.branches.branches);
  const auth = useSelector(s => s.auth);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const toast = useToast();
  const initialTaxRef = useRef(settings.taxRate);
  const canEditTax = ['Admin','Manager'].includes(auth.role) || String(auth.role || '').toLowerCase() === 'superadmin';

  function addNewBranch() {
    if (!branchName.trim() || !branchCode.trim()) return;
    dispatch(addBranch({ name: branchName.trim(), code: branchCode.trim() }));
    setBranchName('');
    setBranchCode('');
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Configuration</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h2 className="section-title">App Identity</h2>
          <label>
            App Name
            <input className="input" value={settings.appName} onChange={e => dispatch(setAppName(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Footer Text
            <input className="input" value={settings.footerText} onChange={e => dispatch(setFooterText(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <div style={{ marginTop: 12, color: '#64748b' }}>
            Receipt will use the app logo from /logo512.png
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            Receipt Header
            <input className="input" value={settings.receiptHeader} onChange={e => dispatch(setReceiptHeader(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Receipt Footer
            <input className="input" value={settings.receiptFooter} onChange={e => dispatch(setReceiptFooter(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            <input type="checkbox" checked={!!settings.drawerOpenOnCash} onChange={e => dispatch(setDrawerOpenOnCash(e.target.checked))} />
            <span style={{ marginLeft: 8 }}>Trigger Drawer Open on Cash payment</span>
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Default Tax Rate (%)
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={Math.round((settings.taxRate || 0) * 10000) / 100}
              onChange={e => {
                const pct = Number(e.target.value);
                if (!Number.isNaN(pct) && canEditTax) dispatch(setTaxRate(pct / 100));
              }}
              disabled={!canEditTax}
              style={{ display: 'block', width: '100%', marginTop: 6 }}
            />
          </label>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                const before = initialTaxRef.current || 0;
                const after = settings.taxRate || 0;
                if (before !== after) {
                  if (!canEditTax) {
                    toast.show('Not permitted to change tax rate', { type: 'error' });
                    return;
                  }
                  const remark = window.prompt('Enter remark for tax rate change') || '';
                  if (!remark.trim()) {
                    toast.show('Remark is required for tax change', { type: 'error' });
                    return;
                  }
                  dispatch(addAudit({
                    actor: auth.user?.name || 'unknown',
                    actionType: 'tax_rate_change',
                    details: { from: Math.round(before * 100), to: Math.round(after * 100) },
                    remark
                  }));
                  initialTaxRef.current = after;
                }
                toast.show('Settings saved', { type: 'success' });
              }}
            >
              Save
            </button>
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Branches</h2>
          <div style={{ marginBottom: 8 }}>
            <label>
              Current Branch
              <select className="select" value={settings.currentBranchId} onChange={e => dispatch(setCurrentBranch(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <input className="input" placeholder="Branch name" value={branchName} onChange={e => setBranchName(e.target.value)} />
            <input className="input" placeholder="Code" value={branchCode} onChange={e => setBranchCode(e.target.value)} />
            <button className="btn btn-primary" onClick={addNewBranch}>Add</button>
          </div>
          <ul>
            {branches.map(b => (
              <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{b.name} ({b.code})</span>
                <button className="btn" onClick={() => dispatch(removeBranch(b.id))} disabled={b.id === 'main'}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ConfigSettingsPage;
