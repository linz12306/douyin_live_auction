import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe } from './api/user';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ProductList from './pages/merchant/ProductList';
import ProductForm from './pages/merchant/ProductForm';
import ProductDetail from './pages/merchant/ProductDetail';
import AuctionLobby from './pages/app/AuctionLobby';
import LiveAuctionRoom from './pages/app/LiveAuctionRoom';
import AppOrderList from './pages/app/OrderList';
import AppOrderDetail from './pages/app/OrderDetail';
import { useAuthStore } from './store/authStore';
import type { Role } from './types/user';

function AuthLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-center text-white/65">
      加载中...
    </div>
  );
}

export function ProtectedRoute({
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
    if (!refreshToken || isHydrating || (user && accessToken)) return;

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
  if (!user || !accessToken) return <AuthLoading />;
  if (requiredRole && user && user.role !== requiredRole) {
    return <Navigate to={fallbackPath || '/profile'} replace />;
  }
  return <>{children}</>;
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
        <Route path="/app/auctions/:id" element={<ProtectedRoute requiredRole="user" fallbackPath="/merchant/products"><LiveAuctionRoom /></ProtectedRoute>} />
        <Route path="/app/orders" element={<ProtectedRoute requiredRole="user" fallbackPath="/merchant/products"><AppOrderList /></ProtectedRoute>} />
        <Route path="/app/orders/:id" element={<ProtectedRoute requiredRole="user" fallbackPath="/merchant/products"><AppOrderDetail /></ProtectedRoute>} />
        <Route path="/merchant/products" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductList /></ProtectedRoute>} />
        <Route path="/merchant/products/new" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductForm /></ProtectedRoute>} />
        <Route path="/merchant/products/:id" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductDetail /></ProtectedRoute>} />
        <Route path="/merchant/products/:id/edit" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><ProductForm /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
