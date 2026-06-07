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
  cancelAuction: vi.fn(),
}));

vi.mock('../../api/product', () => ({
  getProduct: mocks.getProduct,
  deleteProduct: mocks.deleteProduct,
}));

vi.mock('../../api/auction', () => ({
  activateAuction: mocks.activateAuction,
  cancelAuction: mocks.cancelAuction,
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

const cancelledDetail: PD = {
  ...pendingDetail,
  product: {
    ...pendingDetail.product,
    status: 'cancelled',
    updated_at: '2026-05-29T10:02:00.000Z',
  },
  auction: {
    ...pendingDetail.auction!,
    status: 'cancelled',
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
    mocks.cancelAuction.mockReset();
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

  it('links the auction detail to the merchant realtime monitor', async () => {
    mocks.getProduct.mockResolvedValueOnce(pendingDetail);

    renderDetail();

    const monitorLink = await screen.findByRole('link', { name: '进入实时竞拍监控台 ›' });
    expect(monitorLink).toHaveAttribute('href', '/merchant/auctions/9/monitor');
  });

  it('cancels a pending auction with a reason and refreshes the detail state', async () => {
    mocks.getProduct.mockResolvedValueOnce(pendingDetail).mockResolvedValueOnce(cancelledDetail);
    mocks.cancelAuction.mockResolvedValueOnce(undefined);

    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: '取消竞拍' }));
    fireEvent.change(screen.getByLabelText('取消原因'), { target: { value: '库存不足' } });
    fireEvent.click(screen.getByRole('button', { name: '确认取消竞拍' }));

    await waitFor(() => expect(mocks.cancelAuction).toHaveBeenCalledWith(9, '库存不足'));
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('已取消')).toBeInTheDocument();
  });

  it('requires a cancellation reason before calling the API', async () => {
    mocks.getProduct.mockResolvedValueOnce(pendingDetail);

    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: '取消竞拍' }));
    fireEvent.click(screen.getByRole('button', { name: '确认取消竞拍' }));

    expect(mocks.cancelAuction).not.toHaveBeenCalled();
    expect(screen.getByText('请输入取消原因')).toBeInTheDocument();
  });

  it('shows the backend cancellation error when active auction cancellation is blocked', async () => {
    mocks.getProduct.mockResolvedValueOnce(activeDetail);
    mocks.cancelAuction.mockRejectedValueOnce({
      response: { data: { message: '最后出价后30秒内不可取消' } },
    });

    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: '取消竞拍' }));
    fireEvent.change(screen.getByLabelText('取消原因'), { target: { value: '价格异常' } });
    fireEvent.click(screen.getByRole('button', { name: '确认取消竞拍' }));

    await waitFor(() => expect(mocks.cancelAuction).toHaveBeenCalledWith(9, '价格异常'));
    expect(await screen.findByText('最后出价后30秒内不可取消')).toBeInTheDocument();
  });
});
