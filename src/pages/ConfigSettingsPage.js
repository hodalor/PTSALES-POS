import { useDispatch, useSelector } from 'react-redux';
import { setAppName, setFooterText, setCurrentBranch, setReceiptHeader, setReceiptFooter, setBusinessPhone, setBusinessWebsite, setBusinessTpin, setReceiptQrBaseUrl, setInvoicePrefix, setNextInvoiceNumber, setReceiptPrefix, setNextReceiptNumber, setDrawerOpenOnCash, setTaxRate, setCurrencyCode, setCurrencySymbol, setCurrencyPosition, setRefreshIntervalSec, addCurrency, removeCurrency, setActiveCurrency, setLoyaltyEnabled, setLoyaltyEarnAmount, setLoyaltyEarnPoints, setLoyaltyRedeemValue, setLoyaltyMinRedeemPoints, setLoyaltyMaxRedeemPercent, setClientAppName, setClientLogoUrl } from '../store/settingsSlice';
import { addBranch, removeBranch, updateBranch } from '../store/branchesSlice';
import * as branchesApi from '../api/branches';
import { useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';
import { addAudit } from '../store/auditSlice';
import { fetchJson, getApiBase, setApiBase } from '../api/client';
import * as settingsApi from '../api/settings';
import { enqueueHttp, isOfflineBackupEnabled } from '../offline/offlineBackup';
import OfflineQueueIndicator from '../components/OfflineQueueIndicator';

function ConfigSettingsPage() {
  const dispatch = useDispatch();
  const settings = useSelector(s => s.settings);
  const branches = useSelector(s => s.branches.branches);
  const auth = useSelector(s => s.auth);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [newCurCode, setNewCurCode] = useState('');
  const [newCurSymbol, setNewCurSymbol] = useState('');
  const [newCurPos, setNewCurPos] = useState('prefix');
  const toast = useToast();
  const initialTaxRef = useRef(settings.taxRate);
  const canEditTax = ['Admin','Manager'].includes(auth.role) || String(auth.role || '').toLowerCase() === 'superadmin';
  const roleLower = String(auth.role || '').toLowerCase();
  const canManageBranches = roleLower === 'admin' || roleLower === 'superadmin';
  const isSuperAdmin = roleLower === 'superadmin';
  const offlineBackupAllowed = isOfflineBackupEnabled(settings);
  const [apiBase, setApiBaseState] = useState(() => {
    try { return getApiBase(); } catch { return ''; }
  });

  function addNewBranch() {
    if (!branchName.trim() || !branchCode.trim()) return;
    const action = dispatch(addBranch({ name: branchName.trim(), code: branchCode.trim() }));
    const created = action?.payload;
    if (!navigator.onLine && !offlineBackupAllowed) {
      if (created) dispatch(removeBranch(created.id));
      toast.show('Offline: connect internet and try again.', { type: 'error' });
      return;
    }
    if (created) {
      if (!navigator.onLine) {
        enqueueHttp({ collection: 'branches', label: 'Branch', path: '/api/branches', method: 'POST', body: { id: created.id, name: created.name, code: created.code } })
          .catch(() => {
            dispatch(removeBranch(created.id));
            toast.show('Failed to save offline', { type: 'error' });
          });
      } else {
        branchesApi.create({ id: created.id, name: created.name, code: created.code })
          .catch(() => {
            dispatch(removeBranch(created.id));
            toast.show('Failed to create branch on server', { type: 'error' });
          });
      }
    }
    setBranchName('');
    setBranchCode('');
  }
  
  async function onEditBranch(b) {
    if (!canManageBranches) {
      toast.show('Only Admin or SuperAdmin can edit branches', { type: 'error' });
      return;
    }
    const { promptDialog } = await import('../utils/dialogs');
    const newName = await promptDialog('Enter new branch name', b.name);
    if (!newName || !newName.trim()) return;
    const newCode = await promptDialog('Enter new branch code', b.code);
    if (!newCode || !newCode.trim()) return;
    const patch = { name: newName.trim(), code: newCode.trim() };
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: connect internet and try again.', { type: 'error' });
        return;
      }
      dispatch(updateBranch({ id: b.id, ...patch, offline: true }));
      try {
        await enqueueHttp({ collection: 'branches', label: 'Branch update', path: `/api/branches/${encodeURIComponent(b.id)}`, method: 'PUT', body: patch });
        toast.show('Saved offline. Will backup when online.', { type: 'success' });
      } catch {
        toast.show('Failed to save offline', { type: 'error' });
      }
      return;
    }
    try {
      await branchesApi.update(b.id, patch);
      dispatch(updateBranch({ id: b.id, ...patch }));
      toast.show('Branch updated', { type: 'success' });
    } catch {
      toast.show('Failed to update branch on server', { type: 'error' });
    }
  }
  
  async function onRemoveBranch(b) {
    if (!canManageBranches) {
      toast.show('Only Admin or SuperAdmin can remove branches', { type: 'error' });
      return;
    }
    const { confirmDialog } = await import('../utils/dialogs');
    const ok = await confirmDialog(`Remove branch ${b.name}?`);
    if (!ok) return;
    if (!navigator.onLine) {
      if (!offlineBackupAllowed) {
        toast.show('Offline: connect internet and try again.', { type: 'error' });
        return;
      }
      dispatch(removeBranch(b.id));
      try {
        await enqueueHttp({ collection: 'branches', label: 'Branch delete', path: `/api/branches/${encodeURIComponent(b.id)}`, method: 'DELETE', body: {} });
        toast.show('Saved offline. Will backup when online.', { type: 'success' });
      } catch {
        toast.show('Failed to save offline', { type: 'error' });
      }
      return;
    }
    try {
      await branchesApi.remove(b.id);
      dispatch(removeBranch(b.id));
      toast.show('Branch removed', { type: 'success' });
    } catch {
      toast.show('Failed to remove branch on server', { type: 'error' });
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Configuration</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <OfflineQueueIndicator collection="settings" label="Settings queued" />
          <OfflineQueueIndicator collection="branches" label="Branches queued" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h2 className="section-title">App Identity</h2>
          {isSuperAdmin && (
            <>
              <label>
                App Name
                <input className="input" value={settings.appName} onChange={e => dispatch(setAppName(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <label>
                  Invoice Prefix
                  <input className="input" value={settings.invoicePrefix || ''} onChange={e => dispatch(setInvoicePrefix(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
                </label>
                <label>
                  Next Invoice Number
                  <input className="input" type="number" min="1" value={settings.nextInvoiceNumber || 1} onChange={e => dispatch(setNextInvoiceNumber(Number(e.target.value)))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <label>
                  Receipt Prefix
                  <input className="input" value={settings.receiptPrefix || ''} onChange={e => dispatch(setReceiptPrefix(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
                </label>
                <label>
                  Next Receipt Number
                  <input className="input" type="number" min="1" value={settings.nextReceiptNumber || 1} onChange={e => dispatch(setNextReceiptNumber(Number(e.target.value)))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
                </label>
              </div>
              <label style={{ display: 'block', marginTop: 12 }}>
                Footer Text
                <input className="input" value={settings.footerText} onChange={e => dispatch(setFooterText(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
              </label>
            </>
          )}
          {(roleLower === 'admin' || isSuperAdmin) && (
            <div style={{ marginTop: 12 }}>
              <h3 className="section-title" style={{ margin: '8px 0' }}>Client App Name</h3>
              <label>
                Client App Name (Top bar)
                <input className="input" value={settings.clientAppName || ''} onChange={e => dispatch(setClientAppName(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
              </label>
              <div style={{ marginTop: 12 }}>
                <h3 className="section-title" style={{ margin: '8px 0' }}>Client App Logo</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img
                    src={settings.clientLogoUrl || '/clientlogo512.png'}
                    alt="client logo preview"
                    width={32}
                    height={32}
                    style={{ borderRadius: 6, border: '1px solid #e2e8f0' }}
                    onError={(e) => {
                      try {
                        const curr = e.currentTarget.src || '';
                        if (curr.endsWith('/clientlogo512.png')) {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/logo512.png';
                        } else {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/clientlogo512.png';
                        }
                      } catch {}
                    }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = String(reader.result || '');
                        dispatch(setClientLogoUrl(dataUrl));
                      };
                      reader.readAsDataURL(f);
                    }}
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => dispatch(setClientLogoUrl(''))}
                    title="Use default logo"
                  >
                    Use default
                  </button>
                </div>
                <div style={{ marginTop: 6, color: '#64748b' }}>
                  Upload image to override top bar logo. Falls back to /clientlogo512.png if empty or load fails.
                </div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, color: '#64748b' }}>
            Receipt will use the app logo from /logo512.png
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            Business Phone
            <input className="input" value={settings.businessPhone || ''} onChange={e => dispatch(setBusinessPhone(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Website
            <input className="input" value={settings.businessWebsite || ''} onChange={e => dispatch(setBusinessWebsite(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <label>
              TIN/TPIN
              <input className="input" value={settings.businessTpin || ''} onChange={e => dispatch(setBusinessTpin(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            Receipt QR Base URL
            <input className="input" placeholder="e.g., https://pos.yourdomain.com" value={settings.receiptQrBaseUrl || ''} onChange={e => dispatch(setReceiptQrBaseUrl(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Receipt Header
            <input className="input" value={settings.receiptHeader} onChange={e => dispatch(setReceiptHeader(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            Receipt Footer
            <input className="input" value={settings.receiptFooter} onChange={e => dispatch(setReceiptFooter(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          {isSuperAdmin && (
            <label style={{ display: 'block', marginTop: 12 }}>
              <input type="checkbox" checked={!!settings.drawerOpenOnCash} onChange={e => dispatch(setDrawerOpenOnCash(e.target.checked))} />
              <span style={{ marginLeft: 8 }}>Trigger Drawer Open on Cash payment</span>
            </label>
          )}
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
            <h3 className="section-title" style={{ margin: '8px 0' }}>Loyalty Points</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <input type="checkbox" checked={!!settings.loyaltyEnabled} onChange={e => dispatch(setLoyaltyEnabled(e.target.checked))} />
              <span style={{ marginLeft: 8 }}>Enable loyalty points</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                Earn: Amount spent
                <input className="input" type="number" min="0" step="0.01" value={settings.loyaltyEarnAmount || 0} onChange={e => dispatch(setLoyaltyEarnAmount(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} disabled={!settings.loyaltyEnabled} />
              </label>
              <label>
                Earn: Points
                <input className="input" type="number" min="0" step="1" value={settings.loyaltyEarnPoints || 0} onChange={e => dispatch(setLoyaltyEarnPoints(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} disabled={!settings.loyaltyEnabled} />
              </label>
              <label>
                Redeem value (money per point)
                <input className="input" type="number" min="0" step="0.01" value={settings.loyaltyRedeemValue || 0} onChange={e => dispatch(setLoyaltyRedeemValue(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} disabled={!settings.loyaltyEnabled} />
              </label>
              <label>
                Minimum redeem points
                <input className="input" type="number" min="0" step="1" value={settings.loyaltyMinRedeemPoints || 0} onChange={e => dispatch(setLoyaltyMinRedeemPoints(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} disabled={!settings.loyaltyEnabled} />
              </label>
              <label>
                Max redeem (% of sale)
                <input className="input" type="number" min="0" max="100" step="1" value={settings.loyaltyMaxRedeemPercent ?? 50} onChange={e => dispatch(setLoyaltyMaxRedeemPercent(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} disabled={!settings.loyaltyEnabled} />
              </label>
            </div>
            <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
              Example: Earn Amount=100 and Points=5 means every 100 spent earns 5 points. Redeem value controls discount.
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <h3 className="section-title" style={{ margin: '8px 0' }}>Currency</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                Code
                <input className="input" value={settings.currencyCode} onChange={e => dispatch(setCurrencyCode(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
              </label>
              <label>
                Symbol
                <input className="input" value={settings.currencySymbol} onChange={e => dispatch(setCurrencySymbol(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }} />
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>
              Position
              <select className="select" value={settings.currencyPosition} onChange={e => dispatch(setCurrencyPosition(e.target.value))} style={{ display: 'block', width: '100%', marginTop: 6 }}>
                <option value="prefix">Prefix (₵10.00)</option>
                <option value="suffix">Suffix (10.00₵)</option>
              </select>
            </label>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Currencies</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6 }}>
                <select className="select" value={settings.activeCurrencyCode || settings.currencyCode} onChange={e => dispatch(setActiveCurrency(e.target.value))}>
                  {(settings.currencies || []).map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
                <input className="input" placeholder="New code" value={newCurCode} onChange={e => setNewCurCode(e.target.value.toUpperCase())} />
                <input className="input" placeholder="New symbol" value={newCurSymbol} onChange={e => setNewCurSymbol(e.target.value)} />
                <select className="select" value={newCurPos} onChange={e => setNewCurPos(e.target.value)}>
                  <option value="prefix">Prefix</option>
                  <option value="suffix">Suffix</option>
                </select>
                <button className="btn" onClick={() => {
                  if (!newCurCode || !newCurSymbol) return;
                  dispatch(addCurrency({ code: newCurCode, symbol: newCurSymbol, position: newCurPos }));
                  setNewCurCode('');
                  setNewCurSymbol('');
                }}>Add</button>
              </div>
              <ul style={{ marginTop: 8 }}>
                {(settings.currencies || []).map(c => (
                  <li key={c.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '6px 0' }}>
                    <span>{c.code} {c.position === 'suffix' ? `(10.00${c.symbol})` : `(${c.symbol}10.00)`}</span>
                    <span>
                      <button className="btn" onClick={() => dispatch(setActiveCurrency(c.code))} disabled={(settings.activeCurrencyCode||settings.currencyCode)===c.code}>Use</button>
                      <button className="btn" onClick={() => dispatch(removeCurrency(c.code))} style={{ marginLeft: 6 }} disabled={(settings.activeCurrencyCode||settings.currencyCode)===c.code}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {isSuperAdmin && (
            <div style={{ marginTop: 12 }}>
              <h3 className="section-title" style={{ margin: '8px 0' }}>Background Refresh</h3>
              <label>
                Interval (seconds)
                <input
                  className="input"
                  type="number"
                  min="10"
                  max="3600"
                  value={settings.refreshIntervalSec || 60}
                  onChange={e => dispatch(setRefreshIntervalSec(Number(e.target.value)))}
                  disabled={!canEditTax}
                  style={{ display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
              <div style={{ marginTop: 6, color: '#64748b' }}>
                Used for auto-refreshing products, customers, suppliers, branches, refunds and sales.
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      const pong = await fetchJson('/');
                      await fetchJson('/api/branches');
                      toast.show(`API OK: ${pong?.name || 'online'}`, { type: 'success' });
                    } catch (e) {
                      toast.show('API test failed', { type: 'error' });
                    }
                  }}
                >
                  Test API
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    try {
                      localStorage.removeItem('ptSales:state');
                      toast.show('Local data cleared', { type: 'success' });
                    } catch {}
                  }}
                >
                  Clear Local Data
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
                <h3 className="section-title" style={{ margin: '8px 0' }}>API Endpoint</h3>
                <label>
                  Base URL
                  <input
                    className="input"
                    placeholder="http://localhost:4000"
                    value={apiBase}
                    onChange={e => setApiBaseState(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: 6 }}
                  />
                </label>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      try {
                        setApiBase(apiBase);
                        toast.show('API base saved', { type: 'success' });
                      } catch {
                        toast.show('Failed to save API base', { type: 'error' });
                      }
                    }}
                  >
                    Save API Base
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={async () => {
                const before = initialTaxRef.current || 0;
                const after = settings.taxRate || 0;
                if (before !== after) {
                  if (!canEditTax) {
                    toast.show('Not permitted to change tax rate', { type: 'error' });
                    return;
                  }
                  const { promptDialog } = await import('../utils/dialogs');
                  const remark = await promptDialog('Enter remark for tax rate change');
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
                try {
                  if (!navigator.onLine) {
                    if (!offlineBackupAllowed) {
                      toast.show('Offline: connect internet and try again.', { type: 'error' });
                      return;
                    }
                    const payload = (() => {
                      const copy = { ...(settings || {}) };
                      if (roleLower === 'admin' && copy && Object.prototype.hasOwnProperty.call(copy, 'featureFlags')) {
                        delete copy.featureFlags;
                      }
                      return copy;
                    })();
                    await enqueueHttp({ collection: 'settings', label: 'Settings', path: '/api/settings', method: 'PUT', body: payload });
                    toast.show('Saved offline. Will backup when online.', { type: 'success' });
                    return;
                  }
                  const payload = (() => {
                    const copy = { ...(settings || {}) };
                    if (roleLower === 'admin' && copy && Object.prototype.hasOwnProperty.call(copy, 'featureFlags')) {
                      delete copy.featureFlags;
                    }
                    return copy;
                  })();
                  await settingsApi.save(payload);
                  toast.show('Settings saved', { type: 'success' });
                } catch {
                  toast.show('Failed to save settings', { type: 'error' });
                }
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
            <input className="input" placeholder="Branch name" value={branchName} onChange={e => setBranchName(e.target.value)} disabled={!canManageBranches} />
            <input className="input" placeholder="Code" value={branchCode} onChange={e => setBranchCode(e.target.value)} disabled={!canManageBranches} />
            <button className="btn btn-primary" onClick={addNewBranch} disabled={!canManageBranches}>Add</button>
          </div>
          <ul>
            {branches.map(b => (
              <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span>{b.name} ({b.code})</span>
                <span>
                  <button className="btn" onClick={() => onEditBranch(b)} disabled={!canManageBranches}>Edit</button>
                  <button className="btn" onClick={() => onRemoveBranch(b)} disabled={!canManageBranches || b.id === 'main'} style={{ marginLeft: 8 }}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ConfigSettingsPage;
