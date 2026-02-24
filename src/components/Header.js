import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { setCurrentBranch } from '../store/settingsSlice';
import BranchSelect from './BranchSelect';

function Header() {
  const auth = useSelector(state => state.auth);
  const appName = useSelector(state => state.settings.appName);
  const currentBranchId = useSelector(state => state.settings.currentBranchId);
  const dispatch = useDispatch();

  return (
    <div className="topbar">
      <div className="brand">
        <img src="/logo512.png" alt="logo" />
        <strong>{appName}</strong>
        <BranchSelect value={currentBranchId} onChange={id => dispatch(setCurrentBranch(id))} style={{ marginLeft: 12 }} />
      </div>
      <div>
        {auth.isAuthenticated ? (
          <>
            <span style={{ marginRight: 12 }}>
              {auth.user?.name} — {auth.role}
            </span>
            <button className="btn" onClick={() => dispatch(logout())}>Logout</button>
          </>
        ) : (
          <span>Not signed in</span>
        )}
      </div>
    </div>
  );
}

export default Header;
