import { Outlet } from 'react-router-dom';
import Header from './Header';
import OfflineBanner from './OfflineBanner';
import Sidebar from './Sidebar';
import Breadcrumbs from './Breadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { setQueueSummary } from '../store/offlineQueueSlice';
import { getQueueSummary, isOfflineBackupEnabled } from '../offline/offlineBackup';
import { attemptSync } from '../offline/queue';
import { syncQueuedItem } from '../offline/syncHandlers';

function Layout() {
  const dispatch = useDispatch();
  const footer = useSelector(s => s.settings.footerText);
  const settings = useSelector(s => s.settings);
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const summary = await getQueueSummary();
        if (alive) dispatch(setQueueSummary(summary));
        if (navigator.onLine && summary.total > 0 && isOfflineBackupEnabled(settings)) {
          await attemptSync(syncQueuedItem);
          const after = await getQueueSummary();
          if (alive) dispatch(setQueueSummary(after));
        }
      } catch {}
    }
    refresh();
    const id = setInterval(refresh, 5000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [dispatch, settings]);
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
