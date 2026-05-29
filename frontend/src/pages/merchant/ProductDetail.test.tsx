// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDetail as PD } from '../../types/product';
import ProductDetail from './ProductDetail';

const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  deleteProduct: vi.fn(),
  activateAuction: vi.fn(),
}));

vi.mock('../../api/product', () => ({
  getProduct: mocks.getProduct,
  deleteProduct: mocks.deleteProduct,
}));

vi.mock('../../api/auction', () => ({
  activateAuction: mocks.activateAuction,
}));

const pendingDetail: PD = {
  product: {
    id: 12,
    merchant_id: 1,
    title: '复古夹克',
    description: '水洗牛仔',
    status: 'pending',
    created_at: '2026-05-29T10:00:00.000Z',
    updated_at: '2026-05-29T10:00:00.000Z',
  },
  images: [],
  auction: {
    id: 9,
    product_id: 12,
    start_price: 0,
    bid_increment_type: 'fixed',
    bid_increment_value: 10,
    ceiling_price: null,
    duration_seconds: 60,
    auto_extend_seconds: 15,
    max_extend_count: 5,
    current_extend_count: 0,
    status: 'pending',
    current_price: 0,
    highest_bidder_id: null,
    version: 1,
    created_at: '2026-05-29T10:00:00.000Z',
  },
};

const activeDetail: PD = {
  ...pendingDetail,
  product: {
    ...pendingDetail.product,
    status: 'active',
    updated_at: '2026-05-29T10:01:00.000Z',
  },
  auction: {
    ...pendingDetail.auction!,
    status: 'active',
    version: 2,
  },
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/merchant/products/12']}>
      <Routes>
        <Route path="/merchant/products/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductDetail', () => {
  beforeEach(() => {
    mocks.getProduct.mockReset();
    mocks.deleteProduct.mockReset();
    mocks.activateAuction.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts a pending auction and refreshes the detail state', async () => {
    mocks.getProduct.mockResolvedValueOnce(pendingDetail).mockResolvedValueOnce(activeDetail);
    mocks.activateAuction.mockResolvedValueOnce(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: '开拍' }));

    await waitFor(() => expect(mocks.activateAuction).toHaveBeenCalledWith(9));
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('进行中')).toBeInTheDocument();
  });
});
