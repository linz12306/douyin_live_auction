// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import type { LoginResponse, User } from '../types/user';
import Login from './Login';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
}));

const mockedLogin = vi.mocked(login);

const baseUser: User = {
  id: 1,
  username: 'demo_merchant',
  role: 'merchant',
  display_name: 'Demo Merchant',
  avatar_url: '',
  balance: 0,
  frozen_amount: 0,
};

function authResponse(user: User): LoginResponse {
  return {
    access_token: `${user.role}-access`,
    refresh_token: `${user.role}-refresh`,
    user,
  };
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/merchant/products" element={<div>商家商品管理</div>} />
        <Route path="/app/auctions" element={<div>用户发现竞拍</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isHydrating: false,
    });
    mockedLogin.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('routes demo merchant accounts to merchant product management', async () => {
    mockedLogin.mockResolvedValueOnce(authResponse(baseUser));

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'demo_merchant' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'test123' } });
    fireEvent.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => expect(screen.getByText('商家商品管理')).toBeInTheDocument());
    expect(mockedLogin).toHaveBeenCalledWith('demo_merchant', 'test123');
    expect(useAuthStore.getState().user?.role).toBe('merchant');
  });

  it('routes demo buyer accounts to the H5 auction discovery page', async () => {
    mockedLogin.mockResolvedValueOnce(authResponse({
      ...baseUser,
      id: 2,
      username: 'demo_buyer_a',
      role: 'user',
      display_name: 'Demo Buyer A',
    }));

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'demo_buyer_a' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'test123' } });
    fireEvent.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => expect(screen.getByText('用户发现竞拍')).toBeInTheDocument());
    expect(mockedLogin).toHaveBeenCalledWith('demo_buyer_a', 'test123');
    expect(useAuthStore.getState().user?.role).toBe('user');
  });
});
