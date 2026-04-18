import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useToast } from '../components/ToastProvider';
import { attemptSync } from '../offline/queue';
import { COLLECTIONS, listQueuedByCollection, removeQueuedCollection, removeQueuedIds } from '../offline/offlineBackup';
import { syncQueuedItem } from '../offline/syncHandlers';
import { ensureOnlineJwt } from '../offline/reAuth';
import { refreshAllData } from '../offline/refreshAll';
import { useDispatch } from 'react-redux';
import { listImeiConflicts } from '../offline/imeiConflicts';
import { confirmDialog } from '../utils/dialogs';
import { exportAllData, importAllData } from '../api/dataMigration';

function BackupPage() {
  const toast = useToast();
  const settings = useSelector(s => s.settings);
  const auth = useSelector(s => s.auth);
  const summary = useSelector(s => s.offlineQueue);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [itemsByCollection, setItemsByCollection] = useState(new Map());
  const [imeiConflictCount, setImeiConflictCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const isSuperAdmin = String(auth?.role || '').toLowerCase() === 'superadmin';
  const grants = Array.isArray(auth?.grants) ? auth.grants : [];
  const canExportData = isSuperAdmin || grants.includes('export_data');
  const canImportData = isSuperAdmin || grants.includes('import_data');
  const [migrationMode, setMigrationMode] = useState('merge');
  const [importCollections, setImportCollections] = useState(null);
  const [importFileName, setImportFileName] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const map = await listQueuedByCollection();
        if (alive) setItemsByCollection(map);
        if (alive) setImeiConflictCount(listImeiConflicts().length);
      } catch {
        if (alive) setItemsByCollection(new Map());
      }
    }
    load();
    const id = setInterval(load, 5000);
    window.addEventListener('online', load);
    window.addEventListener('offline', load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('online', load);
      window.removeEventListener('offline', load);
    };
  }, []);

  const collections = useMemo(() => {
    const by = summary?.byCollection || {};
    return COLLECTIONS.map(c => ({ ...c, count: Number(by[c.key] || 0) }));
  }, [summary]);

  const rows = useMemo(() => {
    const list = itemsByCollection.get(selected) || [];
    return list.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }, [itemsByCollection, selected]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selected]);

  async function reloadQueueMap() {
    try {
      const map = await listQueuedByCollection();
      setItemsByCollection(map);
    } catch {}
  }

  async function onBackupNow() {
    if (loading) return;
    if (!navigator.onLine) {
      toast.show('Offline: connect internet to backup', { type: 'error' });
      return;
    }
    try { await ensureOnlineJwt(); } catch {}
    setLoading(true);
    try {
      const result = await attemptSync(syncQueuedItem);
      const ok = typeof result === 'boolean' ? result : Boolean(result?.ok);
      if (ok) {
        toast.show('Backup completed', { type: 'success' });
      } else {
        const failed = Number(result?.failed || 0);
        const total = Number(result?.total || 0);
        const err = Array.isArray(result?.errors) && result.errors.length > 0 ? ` • ${result.errors[0]}` : '';
        toast.show(`Some items failed to backup (${failed}/${total})${err}`, { type: 'error' });
      }
      try {
        await refreshAllData(dispatch);
      } catch {}
    } catch {
      toast.show('Backup failed', { type: 'error' });
    } finally {
      try {
        await reloadQueueMap();
      } catch {}
      setLoading(false);
    }
  }
  async function onSyncNow() {
    if (loading) return;
    if (!navigator.onLine) {
      toast.show('Offline: connect internet to sync', { type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await ensureOnlineJwt();
      await refreshAllData(dispatch);
      await reloadQueueMap();
      toast.show('Sync completed', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Sync failed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function onRemoveSelected() {
    if (!isSuperAdmin) return;
    const ids = selectedIds.filter(Boolean);
    if (ids.length === 0) return;
    const ok = await confirmDialog(`Remove ${ids.length} selected queued item(s)?`);
    if (!ok) return;
    setLoading(true);
    try {
      await removeQueuedIds(ids);
      setSelectedIds([]);
      await reloadQueueMap();
      toast.show('Selected queue items removed', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to remove selected queue items'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function onClearCollection() {
    if (!isSuperAdmin) return;
    const total = rows.length;
    if (total === 0) return;
    const ok = await confirmDialog(`Remove all ${total} queued item(s) in "${selected}"?`);
    if (!ok) return;
    setLoading(true);
    try {
      await removeQueuedCollection(selected);
      setSelectedIds([]);
      await reloadQueueMap();
      toast.show(`Cleared ${selected} queue`, { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to clear collection queue'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function onExportData() {
    if (!canExportData) return;
    setLoading(true);
    try {
      const payload = await exportAllData();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ptsales-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.show('Data export downloaded', { type: 'success' });
    } catch (e) {
      toast.show(String(e?.message || 'Failed to export data'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function onPickImportFile(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const collections = (parsed?.collections && typeof parsed.collections === 'object')
        ? parsed.collections
        : ((parsed?.data?.collections && typeof parsed.data.collections === 'object') ? parsed.data.collections : null);
      if (!collections) throw new Error('Invalid import file format');
      setImportCollections(collections);
      setImportFileName(file.name);
      toast.show('Import file loaded', { type: 'success' });
    } catch (err) {
      setImportCollections(null);
      setImportFileName('');
      toast.show(String(err?.message || 'Invalid import file'), { type: 'error' });
    }
  }

  async function onRunImport() {
    if (!canImportData || !importCollections) return;
    const labels = Object.entries(importCollections)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => `${key}: ${value.length}`)
      .slice(0, 10)
      .join(', ');
    const ok = await confirmDialog(`Import data in "${migrationMode}" mode? ${labels ? `\n${labels}` : ''}`);
    if (!ok) return;
    setLoading(true);
    try {
      const result = await importAllData({ mode: migrationMode, collections: importCollections });
      const inserted = Number(result?.totals?.inserted || 0);
      const updated = Number(result?.totals?.updated || 0);
      const skipped = Number(result?.totals?.skipped || 0);
      toast.show(`Import complete: inserted ${inserted}, updated ${updated}, skipped ${skipped}`, { type: 'success' });
      await onSyncNow();
      setImportCollections(null);
      setImportFileName('');
    } catch (e) {
      toast.show(String(e?.message || 'Import failed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Backup & Sync</h1>
          <div style={{ color: '#64748b', marginTop: 6 }}>
            Offline queue for cloud-first syncing. Pending: {Number(summary?.total || 0)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/imei-conflicts" className="btn" style={{ textDecoration: 'none' }}>
            IMEI Conflicts{imeiConflictCount > 0 ? `: ${imeiConflictCount}` : ''}
          </Link>
          {canExportData && (
            <button className="btn" onClick={() => void onExportData()} disabled={loading}>
              Export Data
            </button>
          )}
          {canImportData && (
            <>
              <select className="select" value={migrationMode} onChange={e => setMigrationMode(e.target.value)} disabled={loading}>
                <option value="merge">Import: Keep/Merge</option>
                <option value="override">Import: Override DB</option>
              </select>
              <label className="btn" style={{ cursor: 'pointer' }}>
                Pick Import File
                <input type="file" accept="application/json,.json" onChange={e => void onPickImportFile(e)} style={{ display: 'none' }} />
              </label>
              <button className="btn" onClick={() => void onRunImport()} disabled={loading || !importCollections}>
                Import & Sync
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={onBackupNow} disabled={loading || !navigator.onLine || Number(summary?.total || 0) === 0}>
            {loading ? 'Backing up…' : 'Backup Now'}
          </button>
          <button className="btn" onClick={onSyncNow} disabled={loading || !navigator.onLine}>
            {loading ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>
      {canImportData && (
        <div className="card" style={{ padding: 10, marginBottom: 12 }}>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            Import file: {importFileName || 'none selected'} {importCollections ? `• collections: ${Object.keys(importCollections).length}` : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, alignItems: 'start' }}>
        <div className="card" style={{ padding: 10 }}>
          {collections.map(c => (
            <button
              key={c.key}
              className="btn"
              onClick={() => setSelected(c.key)}
              style={{
                width: '100%',
                justifyContent: 'space-between',
                marginBottom: 8,
                background: selected === c.key ? '#0b1220' : undefined,
                color: selected === c.key ? '#fff' : undefined,
                borderColor: selected === c.key ? '#0b1220' : undefined
              }}
            >
              <span style={{ textTransform: 'lowercase' }}>{c.label}</span>
              {c.count > 0 ? (
                <span style={{ minWidth: 26, height: 22, borderRadius: 999, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', color: '#fff', fontWeight: 800, fontSize: 12 }}>
                  {c.count}
                </span>
              ) : (
                <span style={{ color: selected === c.key ? '#cbd5e1' : '#94a3b8', fontSize: 12 }}>0</span>
              )}
            </button>
          ))}
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
            Offline mode: {String(settings?.featureFlags?.['features.offlineBackup'] === false ? 'disabled' : 'enabled')}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <h2 className="section-title" style={{ marginTop: 0, textTransform: 'lowercase' }}>{selected}</h2>
          {isSuperAdmin && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button className="btn" onClick={() => void onRemoveSelected()} disabled={loading || selectedIds.length === 0}>Delete Selected</button>
              <button className="btn" onClick={() => void onClearCollection()} disabled={loading || rows.length === 0}>Delete All In List</button>
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                {isSuperAdmin && (
                  <th align="left">
                    <input
                      type="checkbox"
                      disabled={loading}
                      checked={rows.length > 0 && rows.every(it => selectedIds.includes(it.id))}
                      onChange={e => setSelectedIds(e.target.checked ? rows.map(it => it.id) : [])}
                    />
                  </th>
                )}
                <th align="left">Time</th>
                <th align="left">Action</th>
                <th align="left">Target</th>
                <th align="left">Status</th>
                <th align="left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(it => (
                <tr key={it.id}>
                  {isSuperAdmin && (
                    <td>
                      <input
                        type="checkbox"
                        disabled={loading}
                        checked={selectedIds.includes(it.id)}
                        onChange={e => setSelectedIds(prev => e.target.checked ? [...new Set([...prev, it.id])] : prev.filter(id => id !== it.id))}
                      />
                    </td>
                  )}
                  <td>{new Date(it.ts || Date.now()).toLocaleString()}</td>
                  <td>{it?.payload?.label || it.type}</td>
                  <td><code style={{ fontSize: 12 }}>{it?.payload?.path || ''}</code></td>
                  <td>
                    <span style={{ color: it?.lastError ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                      {it?.lastError ? 'failed' : 'pending'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', maxWidth: 420 }}>
                    {it?.lastError || '—'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? '6' : '5'} style={{ padding: 12, color: '#94a3b8' }}>No pending offline records</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default BackupPage;
