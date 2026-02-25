import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

function ProtectedRoute({ roles, grant, children }) {
  const auth = useSelector(state => state.auth);
  const location = useLocation();
  if (!auth.initialized) {
    return null;
  }
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  const isSuper = String(auth.role || '').toLowerCase() === 'superadmin';
  const grants = Array.isArray(auth.grants) ? auth.grants : [];
  function has(g) {
    if (!g) return false;
    if (grants.includes(g)) return true;
    if (g.startsWith('view_')) return grants.includes(`see_${g.slice(5)}`);
    if (g.startsWith('see_')) return grants.includes(`view_${g.slice(4)}`);
    return false;
  }
  const hasGrant = Array.isArray(grant) ? grant.some(has) : has(grant);
  if (!isSuper && !hasGrant && roles && roles.length > 0 && roles.indexOf(auth.role) === -1) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}

export default ProtectedRoute;
