import { useDispatch, useSelector } from 'react-redux';
import { addUser, removeUser, updateUser } from '../store/usersSlice';
import { addAudit } from '../store/auditSlice';
import { useMemo, useState } from 'react';

function UsersPage() {
  const dispatch = useDispatch();
  const roles = useSelector(s => s.users.roles);
  const branches = useSelector(s => s.branches.branches);
  const users = useSelector(s => s.users.users);
  const auth = useSelector(s => s.auth);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const defaultRoles = ['SuperAdmin','Admin','Branch Manager','Manager','Cashier','Inventory Staff','Auditor','Other'];
  const rolesForUi = Array.from(new Set([...(roles || []), ...defaultRoles]));
  const [role, setRole] = useState(rolesForUi[0] || 'Admin');
  const [branchId, setBranchId] = useState(branches[0]?.id || 'main');
  const [allBranches, setAllBranches] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [remark, setRemark] = useState('');
  const branchOptions = useMemo(() => branches || [], [branches]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('Cashier');
  const [editPin, setEditPin] = useState('');
  const [editAllBranches, setEditAllBranches] = useState(false);
  const [editSelectedBranches, setEditSelectedBranches] = useState([]);
  const [editBranchId, setEditBranchId] = useState(branches[0]?.id || 'main');
  const [editActive, setEditActive] = useState(true);
  const [editRemark, setEditRemark] = useState('');
  const isSuper = String(auth.role || '').toLowerCase() === 'superadmin';
  const superAdminsCount = users.filter(u => u.role === 'SuperAdmin' && u.active !== false).length;
  function canRemoveUser(u) {
    if (isSuper) {
      if (u.role === 'SuperAdmin') return superAdminsCount > 1;
      return true;
    }
    return u.name !== 'superadmin';
  }

  function add() {
    const cleanName = name.trim();
    const cleanPin = pin.trim();
    if (!cleanName || !cleanPin) return;
    if (!/^\d{4,6}$/.test(cleanPin)) {
      alert('PIN must be 4-6 digits');
      return;
    }
    if (!remark.trim()) {
      alert('Please enter a remark for audit logging');
      return;
    }
    const forceAll = role === 'SuperAdmin' || role === 'Admin';
    const assigned = forceAll || allBranches ? 'all' : (selectedBranches.length > 0 ? selectedBranches : [branchId]);
    const primaryBranch = allBranches ? 'main' : (assigned[0] || 'main');
    dispatch(addUser({ name: cleanName, role, pin: cleanPin, branchId: primaryBranch, assignedBranches: assigned }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'user_create',
      details: { name: cleanName, role, branches: allBranches ? 'all' : assigned },
      remark
    }));
    setName('');
    setPin('');
    setRemark('');
    setAllBranches(false);
    setSelectedBranches([]);
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPin('');
    const all = u.role === 'SuperAdmin' || u.role === 'Admin' || u.assignedBranches === 'all';
    setEditAllBranches(all);
    setEditSelectedBranches(Array.isArray(u.assignedBranches) ? u.assignedBranches : (u.branchId ? [u.branchId] : []));
    setEditBranchId(u.branchId || branches[0]?.id || 'main');
    setEditActive(u.active !== false);
    setEditRemark('');
  }

  function saveEdit() {
    if (!editingId) return;
    const target = users.find(u => u.id === editingId);
    const fields = { id: editingId, name: editName.trim(), role: editRole, active: !!editActive };
    // Optional PIN change
    const p = editPin.trim();
    if (p) {
      if (!/^\d{4,6}$/.test(p)) {
        alert('PIN must be 4-6 digits');
        return;
      }
      fields.pin = p;
    }
    // Prevent demoting the last SuperAdmin
    if (target && target.role === 'SuperAdmin' && editRole !== 'SuperAdmin' && superAdminsCount <= 1) {
      alert('At least one SuperAdmin must remain');
      return;
    }
    // Prevent disabling the last SuperAdmin
    if (target && target.role === 'SuperAdmin' && fields.active === false && superAdminsCount <= 1) {
      alert('Cannot disable the last SuperAdmin');
      return;
    }
    // Branch assignment
    const forceAll = editRole === 'SuperAdmin' || editRole === 'Admin';
    if (forceAll || editAllBranches) {
      fields.assignedBranches = 'all';
      fields.branchId = 'main';
    } else {
      const assigned = editSelectedBranches.length > 0 ? editSelectedBranches : [editBranchId];
      fields.assignedBranches = assigned;
      fields.branchId = assigned[0] || editBranchId;
    }
    if (!editRemark.trim()) {
      alert('Please enter a remark for audit logging');
      return;
    }
    dispatch(updateUser(fields));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'user_update',
      details: { id: editingId, role: fields.role, active: fields.active, branches: fields.assignedBranches },
      remark: editRemark
    }));
    setEditingId(null);
  }

  function toggleActive(u, active) {
    const r = window.prompt(active ? 'Remark for enabling user' : 'Remark for disabling user') || '';
    if (!r.trim()) return;
    dispatch(updateUser({ id: u.id, active }));
    dispatch(addAudit({
      actor: auth.user?.name || 'unknown',
      actionType: 'user_status',
      details: { id: u.id, name: u.name, active },
      remark: r
    }));
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Users</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h2>Create User</h2>
          <input placeholder="username" value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginBottom: 8 }} />
          <input placeholder="PIN (4-6 digits)" type="password" value={pin} onChange={e => setPin(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginBottom: 8 }} />
          <select value={role} onChange={e => setRole(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginBottom: 8 }}>
            {rolesForUi.map(r => <option key={r}>{r}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={(role==='SuperAdmin'||role==='Admin') ? true : allBranches} onChange={e => setAllBranches(e.target.checked)} disabled={role==='SuperAdmin'||role==='Admin'} />
            <span>Assign to all branches{(role==='SuperAdmin'||role==='Admin') ? ' (forced)' : ''}</span>
          </label>
          {!((role==='SuperAdmin'||role==='Admin') ? true : allBranches) && (
            <>
              <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginBottom: 8 }}>
                {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Assign additional branches</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {branchOptions.map(b => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={selectedBranches.includes(b.id) || b.id === branchId}
                        onChange={e => {
                          const checked = e.target.checked;
                          setSelectedBranches(prev => {
                            const set = new Set(prev);
                            if (checked) set.add(b.id); else set.delete(b.id);
                            // ensure primary branch is included
                            set.add(branchId);
                            return Array.from(set);
                          });
                        }}
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <input placeholder="Remark (required)" value={remark} onChange={e => setRemark(e.target.value)} style={{ display: 'block', width: '100%', padding: 10, marginBottom: 8 }} />
          <button onClick={add}>Add User</button>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h2>Existing Users</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Role</th>
                <th align="left">Branch Access</th>
                <th align="left">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const access = (u.role === 'SuperAdmin' || u.role === 'Admin' || u.assignedBranches === 'all') ? 'All branches'
                  : (Array.isArray(u.assignedBranches) ? `${u.assignedBranches.length} branches` : (u.branchId || '—'));
                const active = u.active !== false;
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td>{u.name}</td>
                    <td>{u.role}</td>
                    <td>{access}</td>
                    <td>{active ? 'Active' : 'Disabled'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => startEdit(u)}>Edit</button>
                      {(isSuper || u.name !== 'superadmin') && (
                        active
                          ? <button className="btn" onClick={() => toggleActive(u, false)}>Disable</button>
                          : <button className="btn" onClick={() => toggleActive(u, true)}>Enable</button>
                      )}
                      <button
                        className="btn"
                        onClick={() => {
                          if (!canRemoveUser(u)) {
                            alert('Cannot remove the last SuperAdmin');
                            return;
                          }
                          const r = window.prompt('Remark for removing user') || '';
                          if (!r.trim()) return;
                          dispatch(removeUser(u.id));
                        }}
                        disabled={!canRemoveUser(u)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editingId && (
          <div style={{ gridColumn: '1 / span 2', background: '#fff', borderRadius: 12, padding: 16 }}>
            <h2>Edit User</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label>Name</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
                <label>Role</label>
                <select className="select" value={editRole} onChange={e => setEditRole(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }}>
                  {rolesForUi.map(r => <option key={r}>{r}</option>)}
                </select>
                <label>New PIN (leave blank to keep)</label>
                <input className="input" type="password" value={editPin} onChange={e => setEditPin(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={(editRole==='SuperAdmin'||editRole==='Admin') ? true : editAllBranches} onChange={e => setEditAllBranches(e.target.checked)} disabled={editRole==='SuperAdmin'||editRole==='Admin'} />
                  <span>Assign to all branches{(editRole==='SuperAdmin'||editRole==='Admin') ? ' (forced)' : ''}</span>
                </label>
                {!((editRole==='SuperAdmin'||editRole==='Admin') ? true : editAllBranches) && (
                  <>
                    <select className="select" value={editBranchId} onChange={e => setEditBranchId(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }}>
                      {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Assign additional branches</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {branchOptions.map(b => (
                          <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={editSelectedBranches.includes(b.id) || b.id === editBranchId}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEditSelectedBranches(prev => {
                                  const set = new Set(prev);
                                  if (checked) set.add(b.id); else set.delete(b.id);
                                  set.add(editBranchId);
                                  return Array.from(set);
                                });
                              }}
                            />
                            <span>{b.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div>
                <label>Status</label>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={e => setEditActive(e.target.checked)}
                    />
                    <span>Active</span>
                  </label>
                </div>
                <label>Remark (required)</label>
                <input className="input" value={editRemark} onChange={e => setEditRemark(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
                <div>
                  <button className="btn btn-primary" onClick={saveEdit} style={{ marginRight: 8 }}>Save</button>
                  <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersPage;
