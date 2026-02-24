import { Outlet } from 'react-router-dom';
import Header from './Header';
import OfflineBanner from './OfflineBanner';
import Sidebar from './Sidebar';
import Breadcrumbs from './Breadcrumbs';
import { useSelector } from 'react-redux';

function Layout() {
  const footer = useSelector(s => s.settings.footerText);
  return (
    <div className="layout">
      <Sidebar />
      <div className="content">
        <Header />
        <OfflineBanner />
        <Breadcrumbs />
        <main className="main">
          <Outlet />
        </main>
        <div style={{ padding: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>{footer}</div>
      </div>
    </div>
  );
}

export default Layout;
