import { Outlet } from 'react-router-dom';
import Header from './Header';
import OfflineBanner from './OfflineBanner';
import Sidebar from './Sidebar';
import Breadcrumbs from './Breadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { setBeforeInstallPromptEvent } from '../pwa/installPrompt';
import { setQueueSummary } from '../store/offlineQueueSlice';
import { getQueueSummary, isOfflineBackupEnabled } from '../offline/offlineBackup';
import { attemptSync } from '../offline/queue';
import { syncQueuedItem } from '../offline/syncHandlers';

function Layout() {
  const dispatch = useDispatch();
  const footer = useSelector(s => s.settings.footerText);
  const settings = useSelector(s => s.settings);
  const [installEvt, setInstallEvt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
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
    function onBip(e) {
      e.preventDefault();
      setBeforeInstallPromptEvent(e);
      setInstallEvt(e);
      try {
        const dismissed = localStorage.getItem('ptSales:pwaInstallDismissed');
        if (!dismissed) setShowInstall(true);
      } catch {
        setShowInstall(true);
      }
    }
    function onInstalled() {
      setShowInstall(false);
      setInstallEvt(null);
      try { localStorage.setItem('ptSales:pwaInstalled', '1'); } catch {}
    }
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [dispatch, settings]);
  return (
    <div className="layout">
      <Sidebar />
      <div className="content">
        <Header />
        {showInstall && (
          <div className="card" style={{ margin: '8px 16px', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>Install App</div>
              <div style={{ color: '#64748b', fontSize: 12 }}>Install for offline support and faster startup.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!installEvt) return;
                  try {
                    await installEvt.prompt();
                    await installEvt.userChoice;
                  } catch {}
                  setShowInstall(false);
                  setInstallEvt(null);
                }}
              >
                Install App
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowInstall(false);
                  try { localStorage.setItem('ptSales:pwaInstallDismissed', '1'); } catch {}
                }}
              >
                Not now
              </button>
            </div>
          </div>
        )}
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
