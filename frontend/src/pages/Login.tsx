import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import PageBackButton from '../components/PageBackButton';
import { useAuthStore } from '../store/authStore';

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      setAuth(res.user, res.access_token, res.refresh_token);
      navigate(res.user.role === 'merchant' ? '/merchant/products' : '/app/auctions');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080b11] relative overflow-hidden">
      {/* 极光背景微光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/8 blur-[120px] pointer-events-none" />

      <div className="bg-[#111422]/60 backdrop-blur-xl border border-white/8 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/60 relative z-10">
        <PageBackButton fallback="/login" className="mb-6 border-white/10 bg-white/5 hover:bg-white/10" />
        <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent text-center mb-2 tracking-tight">实时竞拍大师</h1>
        <p className="text-slate-400/80 text-center mb-8 text-sm">欢迎回来，请登录您的账号</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 mb-6 text-sm flex items-center gap-2 backdrop-blur">
            <span className="text-red-400 font-bold shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 shadow-inner shadow-black/10"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 shadow-inner shadow-black/10"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 active:scale-[0.98] shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 disabled:opacity-50 disabled:scale-100 transition-all duration-200"
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <p className="text-slate-400/80 text-center mt-6 text-sm">
          还没有账号？<Link to="/register" className="text-purple-400 font-semibold hover:text-purple-300 transition hover:underline underline-offset-4">立即注册</Link>
        </p>
      </div>
    </div>
  );
}
