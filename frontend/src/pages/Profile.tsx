import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe, updateProfile, changePassword, uploadAvatar } from '../api/user';
import { logout as apiLogout } from '../api/auth';
import AvatarUpload from '../components/AvatarUpload';
import PageBackButton from '../components/PageBackButton';

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
}

export default function Profile() {
  const { user, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [nameMsg, setNameMsg] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      navigate('/login');
      return;
    }

    let mounted = true;
    getMe().then((u) => {
      if (!mounted) return;
      useAuthStore.getState().setAuth(
        u,
        useAuthStore.getState().accessToken || '',
        localStorage.getItem('refresh_token') || refreshToken,
      );
      setDisplayName(u.display_name);
    }).catch(() => {
      if (!mounted) return;
      storeLogout();
      navigate('/login');
    });

    return () => {
      mounted = false;
    };
  }, [navigate, storeLogout]);

  const handleUpdateName = async () => {
    setNameMsg('');
    setLoading(true);
    try {
      await updateProfile(displayName);
      setNameMsg('保存成功');
    } catch (err: unknown) {
      setNameMsg(getErrorMessage(err, '保存失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePwd = async () => {
    setPwdMsg('');
    setLoading(true);
    try {
      await changePassword(oldPwd, newPwd);
      setPwdMsg('密码修改成功');
      setOldPwd('');
      setNewPwd('');
    } catch (err: unknown) {
      setPwdMsg(getErrorMessage(err, '修改失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      await apiLogout(refreshToken).catch(() => {});
    }
    storeLogout();
    navigate('/login');
  };

  const handleAvatarUpload = async (file: File) => {
    const url = await uploadAvatar(file);
    if (user) {
      useAuthStore.getState().setAuth(
        { ...user, avatar_url: url },
        useAuthStore.getState().accessToken!,
        localStorage.getItem('refresh_token') || '',
      );
    }
    return url;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080b11] flex items-center justify-center text-slate-400/80">
        加载中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b11] relative overflow-hidden text-white">
      {/* 极光背景微光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/8 blur-[120px] pointer-events-none" />

      <div className="max-w-xl mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
          <div>
            <PageBackButton fallback={user.role === 'merchant' ? '/merchant/products' : '/app/auctions'} className="mb-3 border-white/10 bg-white/5 hover:bg-white/10" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight mt-1">个人中心</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            {user.role === 'merchant' && (
              <>
                <Link
                  to="/merchant/dashboard"
                  className="px-4 py-2 border border-white/10 bg-white/5 text-white/90 rounded-xl hover:border-white/25 hover:bg-white/10 transition duration-200 text-sm font-semibold flex items-center"
                >
                  运营看板
                </Link>
                <Link
                  to="/merchant/products"
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-purple-500/20 transition duration-200 text-sm font-bold flex items-center"
                >
                  商品管理
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400/90 rounded-xl hover:bg-red-500/20 hover:text-red-300 transition duration-200 text-sm font-semibold"
            >
              退出登录
            </button>
          </div>
        </div>

        {/* 头像上传区 */}
        <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-2xl shadow-black/40 mb-5">
          <AvatarUpload currentUrl={user.avatar_url} onUpload={handleAvatarUpload} />
        </div>

        {/* 账户资产信息 */}
        <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-2xl shadow-black/40 mb-5">
          <div className="grid grid-cols-2 divide-x divide-white/10 text-white">
            <div className="pr-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400/80">可用余额</div>
              <div className="mt-1 text-3xl font-black text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text tabular-nums">
                {(user.balance / 10000).toFixed(2)} <span className="text-sm font-bold text-teal-300">万</span>
              </div>
            </div>
            <div className="pl-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400/80">冻结保证金</div>
              <div className="mt-1 text-3xl font-black text-amber-400 tabular-nums">
                {(user.frozen_amount / 10000).toFixed(2)} <span className="text-sm font-bold text-amber-300">万</span>
              </div>
            </div>
          </div>
        </div>

        {/* 修改资料表单 */}
        <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-2xl shadow-black/40 mb-5">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span className="text-purple-400 text-lg">📝</span> 修改资料
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400/80 font-semibold mb-1.5 block">账户用户名 (不可更改)</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-900 text-slate-500/80 cursor-not-allowed text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-semibold mb-1.5 block">昵称</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="昵称"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 text-sm disabled:opacity-50 disabled:scale-100"
                >
                  保存
                </button>
              </div>
            </div>
            {nameMsg && (
              <p className={`text-xs font-semibold px-2 ${nameMsg.includes('成功') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {nameMsg}
              </p>
            )}
          </div>
        </div>

        {/* 修改密码表单 */}
        <div className="bg-[#111422]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-2xl shadow-black/40">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span className="text-pink-400 text-lg">🔒</span> 修改密码
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold mb-1.5 block">当前原密码</label>
              <input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="请输入原密码"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-semibold mb-1.5 block">新密码</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="新密码（至少6位）"
                className="w-full px-4 py-3 rounded-xl bg-slate-950/40 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/15 transition-all duration-200 text-sm"
              />
            </div>
            <button
              onClick={handleChangePwd}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold rounded-xl hover:from-pink-500 hover:to-rose-500 active:scale-[0.98] shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 disabled:opacity-50 disabled:scale-100 transition-all duration-200 text-sm"
            >
              修改密码
            </button>
            {pwdMsg && (
              <p className={`text-xs font-semibold px-2 ${pwdMsg.includes('成功') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pwdMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
