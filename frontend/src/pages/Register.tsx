import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import PageBackButton from '../components/PageBackButton';
import { useAuthStore } from '../store/authStore';

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'user' | 'merchant'>('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register(username, password, role, displayName);
      setAuth(res.user, res.access_token, res.refresh_token);
      navigate(res.user.role === 'merchant' ? '/merchant/products' : '/app/auctions');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '注册失败'));
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
        <p className="text-slate-400/80 text-center mb-8 text-sm">创建您的账号，开启竞拍之旅</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 mb-6 text-sm flex items-center gap-2 backdrop-blur">
            <span className="text-red-400 font-bold shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="用户名（4-20位字母数字下划线）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 shadow-inner shadow-black/10"
              required
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="昵称（最多50字符）"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 shadow-inner shadow-black/10"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 shadow-inner shadow-black/10"
              required
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 block">选择角色</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`p-4 rounded-xl border border-2 text-center transition-all duration-200 ${
                  role === 'user'
                    ? 'border-purple-500 bg-purple-500/15 text-white shadow-lg shadow-purple-500/10'
                    : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-2xl mb-1">👤</div>
                <div className="font-semibold">用户</div>
                <div className="text-xs opacity-70">参与竞拍</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('merchant')}
                className={`p-4 rounded-xl border border-2 text-center transition-all duration-200 ${
                  role === 'merchant'
                    ? 'border-pink-500 bg-pink-500/15 text-white shadow-lg shadow-pink-500/10'
                    : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-2xl mb-1">🏪</div>
                <div className="font-semibold">商家</div>
                <div className="text-xs opacity-70">发布竞拍</div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-violet-500 hover:via-purple-500 hover:to-pink-500 active:scale-[0.98] shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 disabled:opacity-50 disabled:scale-100 transition-all duration-200"
          >
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>

        <p className="text-slate-400/80 text-center mt-6 text-sm">
          已有账号？<Link to="/login" className="text-purple-400 font-semibold hover:text-purple-300 transition hover:underline underline-offset-4">立即登录</Link>
        </p>
      </div>
    </div>
  );
}
