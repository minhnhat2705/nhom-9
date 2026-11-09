import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const result = await authService.login(email.trim(), password);
      login(result.data.user, result.data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) { toast.error(err.message || 'Không thể đăng nhập.'); }
    finally { setBusy(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-7 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-700 text-xl font-bold text-white">L</div>
        <h1 className="text-2xl font-bold text-gray-900">Lumié Warehouse</h1><p className="mt-1 text-sm text-gray-500">Đăng nhập để tiếp tục</p></div>
      <label className="mb-4 block text-sm font-medium text-gray-700">Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500" /></label>
      <label className="mb-6 block text-sm font-medium text-gray-700">Mật khẩu<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-violet-500" /></label>
      <button disabled={busy} className="w-full rounded-lg bg-violet-700 py-2.5 font-semibold text-white hover:bg-violet-800 disabled:opacity-60">{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </form>
  </main>;
}