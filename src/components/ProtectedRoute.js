import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

function ProtectedRoute({ roles, children }) {
  const auth = useSelector(state => state.auth);
  const location = useLocation();
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  const isSuper = String(auth.role || '').toLowerCase() === 'superadmin';
  if (!isSuper && roles && roles.length > 0 && roles.indexOf(auth.role) === -1) {
    return <Navigate to="/pos" replace />;
  }
  return children;
}

export default ProtectedRoute;
