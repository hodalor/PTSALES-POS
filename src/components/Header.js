import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { setCurrentBranch } from '../store/settingsSlice';
import BranchSelect from './BranchSelect';
import NotificationBell from './NotificationBell';

function Header() {
  const auth = useSelector(state => state.auth);
  const settings = useSelector(state => state.settings);
  const currentBranchId = useSelector(state => state.settings.currentBranchId);
  const dispatch = useDispatch();

  return (
    <div className="topbar">
      <div className="brand">
        <img
          src={settings.clientLogoUrl || '/clientlogo512.png'}
          alt="logo"
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
        <strong>{settings.clientAppName || settings.appName}</strong>
        <BranchSelect value={currentBranchId} onChange={id => dispatch(setCurrentBranch(id))} style={{ marginLeft: 12 }} />
      </div>
      <div>
        {auth.isAuthenticated ? (
          <>
            <NotificationBell />
            <span style={{ marginRight: 12 }}>
              {auth.user?.name} — {auth.role}
            </span>
            <button className="btn" onClick={() => { try { localStorage.removeItem('ptSales:authToken'); } catch {} dispatch(logout()); }}>Logout</button>
          </>
        ) : (
          <span>Not signed in</span>
        )}
      </div>
    </div>
  );
}

export default Header;
