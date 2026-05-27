import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMe, updateProfile, changePassword, uploadAvatar } from '../api/user';
import { logout as apiLogout } from '../api/auth';
import AvatarUpload from '../components/AvatarUpload';

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
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      navigate('/login');
      return;
    }
    getMe().then((u) => {
      useAuthStore.getState().setAuth(u, token!, localStorage.getItem('refresh_token') || '');
      setDisplayName(u.display_name);
    }).catch(() => {
      navigate('/login');
    });
  }, []);

  const handleUpdateName = async () => {
    setNameMsg('');
    setLoading(true);
    try {
      await updateProfile(displayName);
      setNameMsg('保存成功');
    } catch (err: any) {
      setNameMsg(err.response?.data?.message || '保存失败');
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
    } catch (err: any) {
      setPwdMsg(err.response?.data?.message || '修改失败');
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-white">个人中心</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/20 transition"
          >
            退出登录
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-4">
          <AvatarUpload currentUrl={user.avatar_url} onUpload={handleAvatarUpload} />
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-4">
          <div className="flex justify-between text-white">
            <div>
              <div className="text-sm text-white/60">可用余额</div>
              <div className="text-2xl font-bold">{(user.balance / 10000).toFixed(2)} 万</div>
            </div>
            <div>
              <div className="text-sm text-white/60">冻结金额</div>
              <div className="text-2xl font-bold text-yellow-300">{(user.frozen_amount / 10000).toFixed(2)} 万</div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-4">
          <h2 className="text-white font-semibold mb-4">修改资料</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/50"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="昵称"
                className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
              <button
                onClick={handleUpdateName}
                disabled={loading}
                className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                保存
              </button>
            </div>
            {nameMsg && <p className={`text-sm ${nameMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>{nameMsg}</p>}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-white font-semibold mb-4">修改密码</h2>
          <div className="space-y-3">
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="原密码"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
            />
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="新密码（至少6位）"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={handleChangePwd}
              disabled={loading}
              className="w-full py-3 bg-pink-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              修改密码
            </button>
            {pwdMsg && <p className={`text-sm ${pwdMsg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>{pwdMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
