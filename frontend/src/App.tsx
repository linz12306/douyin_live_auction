import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ProductList from './pages/merchant/ProductList';
import ProductForm from './pages/merchant/ProductForm';
import ProductDetail from './pages/merchant/ProductDetail';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('refresh_token');
  if (!token) return <Navigate to="/login" replace />;
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
        <Route path="/merchant/products" element={<ProtectedRoute><ProductList /></ProtectedRoute>} />
        <Route path="/merchant/products/new" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
        <Route path="/merchant/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
        <Route path="/merchant/products/:id/edit" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
