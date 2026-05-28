import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
        <h1 className="text-3xl font-bold text-white text-center mb-2">实时竞拍大师</h1>
        <p className="text-white/60 text-center mb-8">创建你的账号</p>

        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-200 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="用户名（4-20位字母数字下划线）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
              required
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="昵称（最多50字符）"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
              required
            />
          </div>

          <div>
            <label className="text-white/80 text-sm mb-2 block">选择角色</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`p-4 rounded-xl border-2 text-center transition ${
                  role === 'user'
                    ? 'border-purple-400 bg-purple-500/20 text-white'
                    : 'border-white/20 bg-white/5 text-white/60 hover:border-white/40'
                }`}
              >
                <div className="text-2xl mb-1">👤</div>
                <div className="font-semibold">用户</div>
                <div className="text-xs opacity-70">参与竞拍</div>
              </button>
              <button
                type="button"
                onClick={() => setRole('merchant')}
                className={`p-4 rounded-xl border-2 text-center transition ${
                  role === 'merchant'
                    ? 'border-pink-400 bg-pink-500/20 text-white'
                    : 'border-white/20 bg-white/5 text-white/60 hover:border-white/40'
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
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>

        <p className="text-white/60 text-center mt-6 text-sm">
          已有账号？<Link to="/login" className="text-purple-300 hover:underline">立即登录</Link>
        </p>
      </div>
    </div>
  );
}
