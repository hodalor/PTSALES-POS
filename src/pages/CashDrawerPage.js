import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { openSession, closeSession, addMovement } from '../store/sessionsSlice';
import { downloadText, escposOpenDrawer } from '../utils/escpos';

function CashDrawerPage() {
  const dispatch = useDispatch();
  const session = useSelector(s => s.sessions);
  const [floatAmount, setFloatAmount] = useState(0);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function openDrawer() {
    dispatch(openSession(Number(floatAmount)));
  }
  function openDrawerNow() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`drawer-open-${ts}.txt`, escposOpenDrawer());
  }
  function record(type) {
    if (!amount) return;
    dispatch(addMovement({ type, amount: Number(amount), note }));
    setAmount('');
    setNote('');
  }
  const totalIn = session.movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalOut = session.movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const expected = session.openingFloat + totalIn - totalOut;

  return (
    <div style={{ padding: 16 }}>
      <h1>Cash Drawer</h1>
      {session.isOpen ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
              <div style={{ color: '#64748b' }}>Opened</div>
              <div style={{ fontWeight: 700 }}>{new Date(session.openedAt).toLocaleString()}</div>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
              <div style={{ color: '#64748b' }}>Opening Float</div>
              <div style={{ fontWeight: 700 }}>${session.openingFloat.toFixed(2)}</div>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
              <div style={{ color: '#64748b' }}>Expected Cash</div>
              <div style={{ fontWeight: 700 }}>${expected.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input placeholder="amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            <input placeholder="note" value={note} onChange={e => setNote(e.target.value)} />
            <button onClick={() => record('in')}>Cash In</button>
            <button onClick={() => record('out')}>Cash Out</button>
            <button onClick={openDrawerNow}>Open Drawer Now</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Time</th>
                <th align="left">Type</th>
                <th align="left">Amount</th>
                <th align="left">Note</th>
              </tr>
            </thead>
            <tbody>
              {session.movements.map((m, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td>{new Date(m.time).toLocaleString()}</td>
                  <td>{m.type}</td>
                  <td>${m.amount.toFixed(2)}</td>
                  <td>{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => dispatch(closeSession())}>Close Session</button>
          </div>
        </>
      ) : (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12, width: 360 }}>
          <h2>Open Cash Drawer</h2>
          <input placeholder="Opening float" type="number" value={floatAmount} onChange={e => setFloatAmount(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
          <button onClick={openDrawer}>Open Session</button>
          <div style={{ marginTop: 8 }}>
            <button onClick={openDrawerNow}>Open Drawer Now</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashDrawerPage;
