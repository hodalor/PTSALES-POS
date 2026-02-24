import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

function NotificationBell() {
  const products = useSelector(s => s.products.products);
  const currentBranchId = useSelector(s => s.settings.currentBranchId);
  const branches = useSelector(s => s.branches.branches);
  const [open, setOpen] = useState(false);
  const branchName = branches.find(b => b.id === currentBranchId)?.name || currentBranchId;
  const lowStock = useMemo(() => {
    return products.filter(p => (p.lowStock ?? 0) > 0 && ((p.stockByBranch?.[currentBranchId] || 0) <= (p.lowStock ?? 0)));
  }, [products, currentBranchId]);
  const count = lowStock.length;
  const navigate = useNavigate();
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginRight: 8, verticalAlign: 'middle' }}>
      <button
        className="btn"
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, padding: 0 }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z" stroke="currentColor" strokeWidth="2"/>
          <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7z" stroke="currentColor" strokeWidth="2"/>
        </svg>
        {count > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', fontSize: 10, lineHeight: '14px', minWidth: 14, height: 14, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {count}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 40, width: 320, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', zIndex: 20 }}>
          <div style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Notifications</div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {lowStock.length === 0 && (
              <div style={{ padding: 12, color: '#64748b' }}>No notifications</div>
            )}
            {lowStock.map(p => {
              const s = p.stockByBranch?.[currentBranchId] || 0;
              return (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                  {p.image ? <img src={p.image} alt={p.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} /> : (
                    <div style={{ width: 32, height: 32, background: '#f1f5f9', borderRadius: 6 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Low stock: {p.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{branchName} • {s} ≤ {p.lowStock}</div>
                  </div>
                  <button className="btn" onClick={() => { setOpen(false); navigate('/products'); }}>View</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}

export default NotificationBell;
