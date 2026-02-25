import { useDispatch, useSelector } from 'react-redux';
import { useMemo, useState } from 'react';
import { addCustomer, updateCustomer, removeCustomer } from '../store/customersSlice';
import { addAudit } from '../store/auditSlice';
import { useToast } from '../components/ToastProvider';
import { confirmDialog } from '../utils/dialogs';
import * as customersApi from '../api/customers';

function CustomersPage() {
  const customers = useSelector(s => s.customers.customers);
  const auth = useSelector(s => s.auth);
  const roleLower = String(auth.role || '').toLowerCase();
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (roleLower === 'superadmin') return true;
    return grants.includes(g);
  }
  const canAddCustomers = (['admin','manager','cashier'].includes(roleLower)) || has('add_customers');
  const canEditCustomers = (['admin','manager','cashier'].includes(roleLower)) || has('edit_customers');
  const canRemoveCustomers = (roleLower === 'admin' || roleLower === 'superadmin');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({ name: '', phone: '', email: '', address: '', notes: '', loyalty: 0, credit: 0 });
  const dispatch = useDispatch();
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [customers, query]);

  async function create() {
    if (!canAddCustomers) { toast.show('Not authorized to add customers', { type: 'error' }); return; }
    if (!name.trim()) { toast.show('Name is required', { type: 'error' }); return; }
    const payload = { name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), notes: notes.trim() };
    const action = dispatch(addCustomer(payload));
    const created = action?.payload;
    if (created) dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'customer_add', details: { id: created.id, name: created.name } }));
    if (created) {
      customersApi.create({ id: created.id, ...payload }).catch(() => {});
    }
    setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes(''); setShowForm(false);
    toast.show('Customer added', { type: 'success' });
  }
  function startEdit(c) {
    if (!canEditCustomers) { toast.show('Not authorized to edit customers', { type: 'error' }); return; }
    setEditingId(c.id);
    setEdit({ name: c.name || '', phone: c.phone || '', email: c.email || '', address: c.address || '', notes: c.notes || '', loyalty: c.loyalty || 0, credit: c.credit || 0 });
  }
  async function saveEdit() {
    if (!canEditCustomers) { toast.show('Not authorized to edit customers', { type: 'error' }); return; }
    const updated = { ...edit, loyalty: Number(edit.loyalty) || 0, credit: Number(edit.credit) || 0 };
    dispatch(updateCustomer({ id: editingId, ...updated }));
    customersApi.update(editingId, updated).catch(() => {});
    dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'customer_update', details: { id: editingId } }));
    setEditingId(null);
    toast.show('Customer updated', { type: 'success' });
  }
  async function remove(id) {
    if (!canRemoveCustomers) { toast.show('Only Admin can remove customers', { type: 'error' }); return; }
    const ok = await confirmDialog('Remove this customer?');
    if (!ok) return;
    dispatch(removeCustomer(id));
    customersApi.remove(id).catch(() => {});
    dispatch(addAudit({ actor: auth.user?.name || 'unknown', actionType: 'customer_remove', details: { id } }));
    toast.show('Customer removed', { type: 'success' });
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Customers</h1>
        {canAddCustomers && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            <svg viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
            {showForm ? 'Close' : 'Add Customer'}
          </button>
        )}
      </div>
      <p>Manage customer profiles, loyalty, and store credit.</p>

      {showForm && canAddCustomers && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <input className="input" placeholder="Name (required)" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
            <input className="input" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} style={{ gridColumn: '1 / span 4' }} />
            <div style={{ gridColumn: '1 / span 4' }}>
              <button className="btn btn-primary" onClick={create}>
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2"/></svg>
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="Search by name, phone, email" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%' }} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Phone</th>
              <th align="left">Email</th>
              <th align="left">Address</th>
              <th align="left">Loyalty</th>
              <th align="left">Credit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td>{editingId === c.id ? <input className="input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /> : c.name}</td>
                <td>{editingId === c.id ? <input className="input" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /> : c.phone || '—'}</td>
                <td>{editingId === c.id ? <input className="input" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /> : c.email || '—'}</td>
                <td>{editingId === c.id ? <input className="input" value={edit.address} onChange={e => setEdit({ ...edit, address: e.target.value })} /> : c.address || '—'}</td>
                <td>{editingId === c.id ? <input className="input" type="number" value={edit.loyalty} onChange={e => setEdit({ ...edit, loyalty: e.target.value })} style={{ width: 80 }} /> : c.loyalty ?? 0}</td>
                <td>{editingId === c.id ? <input className="input" type="number" value={edit.credit} onChange={e => setEdit({ ...edit, credit: e.target.value })} style={{ width: 100 }} /> : (c.credit ?? 0).toFixed(2)}</td>
                <td>
                  {editingId === c.id ? (
                    canEditCustomers ? (
                      <>
                        <button className="btn btn-primary" onClick={saveEdit}>Save</button>
                        <button className="btn" onClick={() => setEditingId(null)} style={{ marginLeft: 6 }}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
                    )
                  ) : (
                    <>
                      {canEditCustomers && <button className="btn" onClick={() => startEdit(c)}>Edit</button>}
                      {canRemoveCustomers && <button className="btn" onClick={() => remove(c.id)} style={{ marginLeft: 6 }}>Remove</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="7" style={{ padding: 12, color: '#64748b' }}>No customers</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CustomersPage;
