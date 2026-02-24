import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

function toCsv(rows) {
  const headers = ['Timestamp','Actor','Action','Branch','Remark','Details'];
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  rows.forEach(r => {
    lines.push([
      r.ts, r.actor, r.actionType, r.branchLabel ?? r.branchId ?? '', r.remark ?? '', JSON.stringify(r.details ?? {})
    ].map(escape).join(','));
  });
  return lines.join('\n');
}

function AuditLogPage() {
  const entries = useSelector(s => s.audit.entries);
  const branches = useSelector(s => s.branches.branches);
  const [qActor, setQActor] = useState('');
  const [qAction, setQAction] = useState('');
  const [qBranch, setQBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const actors = useMemo(() => Array.from(new Set(entries.map(e => e.actor).filter(Boolean))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set(entries.map(e => e.actionType).filter(Boolean))).sort(), [entries]);
  const byId = useMemo(() => {
    const map = new Map();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : 0;
    const toTs = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;
    return entries.filter(e => {
      const ts = new Date(e.ts).getTime();
      if (ts < fromTs || ts > toTs) return false;
      if (qActor && e.actor !== qActor) return false;
      if (qAction && e.actionType !== qAction) return false;
      if (qBranch && e.branchId !== qBranch) return false;
      return true;
    }).map(e => ({ ...e, branchLabel: byId.get(e.branchId) || e.branchId || '—' }));
  }, [entries, from, to, qActor, qAction, qBranch, byId]);

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Audit Log</h1>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          <label>
            From
            <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <label>
            Actor
            <select className="select" value={qActor} onChange={e => setQActor(e.target.value)}>
              <option value="">All</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>
            Action
            <select className="select" value={qAction} onChange={e => setQAction(e.target.value)}>
              <option value="">All</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label>
            Branch
            <select className="select" value={qBranch} onChange={e => setQBranch(e.target.value)}>
              <option value="">All</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div style={{ alignSelf: 'end' }}>
            <button className="btn" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
      </div>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Timestamp</th>
              <th align="left">Actor</th>
              <th align="left">Action</th>
              <th align="left">Branch</th>
              <th align="left">Remark</th>
              <th align="left">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td>{new Date(e.ts).toLocaleString()}</td>
                <td>{e.actor}</td>
                <td>{e.actionType}</td>
                <td>{e.branchLabel}</td>
                <td>{e.remark || '—'}</td>
                <td><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.details || {}, null, 2)}</pre></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="6" style={{ padding: 12, color: '#64748b' }}>No entries</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditLogPage;
