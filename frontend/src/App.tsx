import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import { getMe } from './api/user';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ProductList from './pages/merchant/ProductList';
import ProductForm from './pages/merchant/ProductForm';
import ProductDetail from './pages/merchant/ProductDetail';
import AuctionLobby from './pages/app/AuctionLobby';
import { useAuthStore } from './store/authStore';
import type { Role } from './types/user';

function AuthLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-center text-white/65">
      加载中...
    </div>
  );
}

function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath,
}: {
  children: React.ReactNode;
  requiredRole?: Role;
  fallbackPath?: string;
}) {
  const { user, accessToken, isAuthenticated, isHydrating, setAuth, startHydration, logout } = useAuthStore();
  const refreshToken = localStorage.getItem('refresh_token');

  useEffect(() => {
    if (!refreshToken || user || isHydrating) return;

    startHydration();
    getMe()
      .then((nextUser) => {
        setAuth(
          nextUser,
          useAuthStore.getState().accessToken || accessToken || '',
          localStorage.getItem('refresh_token') || refreshToken,
        );
      })
      .catch(() => {
        logout();
      });
  }, [accessToken, isHydrating, logout, refreshToken, setAuth, startHydration, user]);

  if (!refreshToken || !isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <AuthLoading />;
  if (requiredRole && user && user.role !== requiredRole) {
    return <Navigate to={fallbackPath || '/profile'} replace />;
  }
  return <>{children}</>;
}

function AuctionRoomPlaceholder() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-lg rounded-lg border border-white/12 bg-white/8 p-5">
        <h1 className="text-xl font-semibold">直播间准备中</h1>
        <p className="mt-2 text-sm text-white/60">
          竞拍 {id} 的实时直播间将在下一步接入。
        </p>
        <Link
          to="/app/auctions"
          className="mt-5 inline-flex rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
        >
          返回竞拍大厅
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/app/auctions" element={<ProtectedRoute requiredRole="user" fallbackPath="/merchant/products"><AuctionLobby /></ProtectedRoute>} />
        <Route path="/app/auctions/:id" element={<ProtectedRoute requiredRole="user" fallbackPath="/merchant/products"><AuctionRoomPlaceholder /></ProtectedRoute>} />
        <Route path="/merchant/products" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductList /></ProtectedRoute>} />
        <Route path="/merchant/products/new" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductForm /></ProtectedRoute>} />
        <Route path="/merchant/products/:id" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductDetail /></ProtectedRoute>} />
        <Route path="/merchant/products/:id/edit" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductForm /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
