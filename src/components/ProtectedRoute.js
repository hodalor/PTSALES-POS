import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { isFeatureEnabled } from '../utils/featureFlags';

function ProtectedRoute({ roles, grant, feature, children }) {
  const auth = useSelector(state => state.auth);
  const settings = useSelector(state => state.settings);
  const location = useLocation();
  if (!auth.initialized) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading…</div>;
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (feature && !isFeatureEnabled(settings, feature)) {
    const fallback = location.pathname === '/pos' ? '/dashboard' : '/pos';
    return <Navigate to={fallback} replace />;
  }
  const isSuper = String(auth.role || '').toLowerCase() === 'superadmin';
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  const hasAnyGrant = grants.length > 0;
  function has(g) {
    if (!g) return false;
    if (grants.includes(g)) return true;
    if (g.startsWith('view_')) return grants.includes(`see_${g.slice(5)}`);
    if (g.startsWith('see_')) return grants.includes(`view_${g.slice(4)}`);
    return false;
  }
  const hasGrant = Array.isArray(grant) ? grant.some(has) : has(grant);
  if (!isSuper) {
    if (grant) {
      // Grant-first authorization for users with explicit custom grants.
      // Keep role fallback only for legacy users that have no grants saved yet.
      if (hasAnyGrant && !hasGrant) return <Navigate to="/pos" replace />;
      if (!hasAnyGrant && roles && roles.length > 0 && roles.indexOf(auth.role) === -1) return <Navigate to="/pos" replace />;
    } else if (roles && roles.length > 0 && roles.indexOf(auth.role) === -1) {
      return <Navigate to="/pos" replace />;
    }
  }
  return children;
}

export default ProtectedRoute;
