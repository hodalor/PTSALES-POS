import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState } from 'react';
import { addSupplier, updateSupplier, removeSupplier } from '../store/suppliersSlice';
import { useToast } from '../components/ToastProvider';
import { addAudit } from '../store/auditSlice';
import { confirmDialog } from '../utils/dialogs';

function SuppliersPage() {
  const suppliers = useSelector(s => s.suppliers.suppliers);
  const auth = useSelector(s => s.auth);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: '', contact: '', phone: '', email: '', address: '', notes: '' });
  const dispatch = useDispatch();
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contact || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  function addNew() {
    if (!name.trim()) { toast.show('Name is required', { type: 'error' }); return; }
    const action = dispatch(addSupplier({ name: name.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), notes: notes.trim() }));
    const created = action?.payload;
    if (created) {
      dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'supplier_add', details: { id: created.id, name: created.name } }));
    }
    setName(''); setContact(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    toast.show('Supplier added', { type: 'success' });
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEdit({ name: s.name || '', contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
  }
  function saveEdit() {
    dispatch(updateSupplier({ id: editingId, ...edit }));
    dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'supplier_update', details: { id: editingId } }));
    setEditingId(null);
    toast.show('Supplier updated', { type: 'success' });
  }
  async function remove(id) {
    const ok = await confirmDialog('Remove this supplier?');
    if (!ok) return;
    dispatch(removeSupplier(id));
    dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'supplier_remove', details: { id } }));
    toast.show('Supplier removed', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Suppliers</h1>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          <input className="input" placeholder="Search suppliers" value={query} onChange={e => setQuery(e.target.value)} style={{ gridColumn: '1 / span 4' }} />
          <input className="input" placeholder="Name (required)" value={name} onChange={e => setName(e.target.value)} />
          <input className="input" placeholder="Contact person" value={contact} onChange={e => setContact(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{ gridColumn: '1 / span 2' }} />
          <input className="input" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ gridColumn: '3 / span 2' }} />
          <div style={{ gridColumn: '1 / span 4' }}>
            <button className="btn btn-primary" onClick={addNew}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
              Add Supplier
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="section-title">Supplier List</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Contact</th>
              <th align="left">Phone</th>
              <th align="left">Email</th>
              <th align="left">Address</th>
              <th align="left">Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                  ) : s.name}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.contact} onChange={e => setEdit({ ...edit, contact: e.target.value })} />
                  ) : s.contact || '—'}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
                  ) : s.phone || '—'}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} />
                  ) : s.email || '—'}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.address} onChange={e => setEdit({ ...edit, address: e.target.value })} />
                  ) : s.address || '—'}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
                  ) : s.notes || '—'}
                </td>
                <td>
                  {editingId === s.id ? (
                    <>
                      <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                      <button className="btn" onClick={() => setEditingId(null)} style={{ marginLeft: 6 }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={() => startEdit(s)}>Edit</button>
                      <button className="btn" onClick={() => remove(s.id)} style={{ marginLeft: 6 }}>Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ padding: 12, color: '#64748b' }}>No suppliers</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SuppliersPage;
