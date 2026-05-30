// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listProducts } from '../../api/product';
import type { Product } from '../../types/product';
import ProductList from './ProductList';

vi.mock('../../api/product', () => ({
  listProducts: vi.fn(),
}));

const mockedListProducts = vi.mocked(listProducts);

const baseProduct: Product = {
  id: 12,
  merchant_id: 1,
  title: '复古夹克',
  description: '水洗牛仔',
  status: 'pending',
  created_at: '2026-05-29T10:00:00.000Z',
  updated_at: '2026-05-29T10:00:00.000Z',
};

describe('ProductList', () => {
  beforeEach(() => {
    mockedListProducts.mockReset();
  });

  afterEach(() => cleanup());

  it('refreshes merchant products when the page becomes visible again', async () => {
    mockedListProducts
      .mockResolvedValueOnce({ items: [baseProduct], total: 1, page: 1, size: 20 })
      .mockResolvedValueOnce({
        items: [{ ...baseProduct, title: '更新后的复古夹克', status: 'active' }],
        total: 1,
        page: 1,
        size: 20,
      });
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    render(
      <MemoryRouter>
        <ProductList />
      </MemoryRouter>,
    );

    expect(await screen.findByText('复古夹克')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '待开拍' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进行中' })).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(await screen.findByText('更新后的复古夹克')).toBeInTheDocument();
    expect(screen.getAllByText('进行中').length).toBeGreaterThan(1);
    expect(mockedListProducts).toHaveBeenCalledTimes(2);
    visibilitySpy.mockRestore();
  });

  it('uses separate filters for pending and active products', async () => {
    mockedListProducts.mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });

    render(
      <MemoryRouter>
        <ProductList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mockedListProducts).toHaveBeenCalledWith(undefined));

    fireEvent.click(screen.getByRole('button', { name: '待开拍' }));
    await waitFor(() => expect(mockedListProducts).toHaveBeenLastCalledWith('pending'));

    fireEvent.click(screen.getByRole('button', { name: '进行中' }));
    await waitFor(() => expect(mockedListProducts).toHaveBeenLastCalledWith('active'));
  });

  it('links products with auctions to the merchant realtime monitor', async () => {
    mockedListProducts.mockResolvedValue({
      items: [{ ...baseProduct, auction_id: 9 }],
      total: 1,
      page: 1,
      size: 20,
    });

    render(
      <MemoryRouter>
        <ProductList />
      </MemoryRouter>,
    );

    const monitorLink = await screen.findByRole('link', { name: '实时监控' });
    expect(monitorLink).toHaveAttribute('href', '/merchant/auctions/9/monitor');
  });
});
