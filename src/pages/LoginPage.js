import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginSuccess } from '../store/authSlice';
import * as authApi from '../api/auth';
import { useToast } from '../components/ToastProvider';

function LoginPage() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const appName = useSelector(s => s.settings.appName);
  const from = location.state?.from?.pathname;
  const toast = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ptSales:rememberName');
      if (saved) setName(saved);
    } catch {}
  }, []);

  const regenerateCaptcha = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let str = '';
    for (let i = 0; i < 4; i += 1) str += chars[Math.floor(Math.random() * chars.length)];
    setCaptcha(str);
    setExpiresAt(Date.now() + 60_000);
    setCaptchaInput('');
  }, []);

  useEffect(() => {
    regenerateCaptcha();
  }, [regenerateCaptcha]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() >= expiresAt) regenerateCaptcha();
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, regenerateCaptcha]);

  async function doServerLogin(u, p) {
    const resp = await authApi.login({ username: u, pin: p });
    try { localStorage.setItem('ptSales:authToken', resp.token); } catch {}
    return resp;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (Date.now() >= expiresAt) {
      toast.show('Captcha expired', { type: 'error' });
      regenerateCaptcha();
      return;
    }
    if (captchaInput.trim().toUpperCase() !== captcha.toUpperCase()) {
      toast.show('Captcha mismatch', { type: 'error' });
      regenerateCaptcha();
      return;
    }
    let role = null;
    let landing = '/pos';
    let user = null;
    try {
      const resp = await doServerLogin(name, pin);
      role = resp.role;
      landing = resp.landing || landing;
      user = resp.user;
    } catch {
      toast.show('Invalid credentials', { type: 'error' });
      regenerateCaptcha();
      return;
    }
    if (remember) {
      try { localStorage.setItem('ptSales:rememberName', name); } catch {}
    } else {
      try { localStorage.removeItem('ptSales:rememberName'); } catch {}
    }
    dispatch(loginSuccess({ user, role }));
    navigate(from || landing, { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo512.png" alt="logo" />
          <div>
            <div className="brand-name">{appName}</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input placeholder="username" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="PIN (4-6 digits)" type="password" value={pin} onChange={e => setPin(e.target.value)} />
          <div className="captcha-row">
            <input placeholder="captcha" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} />
            <div className="captcha-box">{captcha}</div>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Captcha refreshes in {Math.max(0, Math.ceil((expiresAt - Date.now())/1000))}s
          </div>
          <label className="remember-row">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>remember PIN</span>
          </label>
          <button type="submit" className="primary">Log In</button>
        </form>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
          Demo: superadmin / 1234
        </div>
        <button className="outline">Reset PIN (Admin)</button>
      </div>
    </div>
  );
}

export default LoginPage;
