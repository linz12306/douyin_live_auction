// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductDetail } from '../../types/product';
import ProductForm from './ProductForm';

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  deleteProductLiveMedia: vi.fn(),
  getProduct: vi.fn(),
  publishProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  uploadProductLiveMedia: vi.fn(),
}));

vi.mock('../../api/product', () => ({
  createProduct: mocks.createProduct,
  deleteProductLiveMedia: mocks.deleteProductLiveMedia,
  getProduct: mocks.getProduct,
  publishProduct: mocks.publishProduct,
  updateProduct: mocks.updateProduct,
  uploadProductImage: mocks.uploadProductImage,
  uploadProductLiveMedia: mocks.uploadProductLiveMedia,
}));

const draftDetail: ProductDetail = {
  product: {
    id: 33,
    merchant_id: 2,
    title: '高帮复古篮球鞋',
    description: '限量配色',
    status: 'draft',
    created_at: '2026-06-03T09:00:00.000Z',
    updated_at: '2026-06-03T09:00:00.000Z',
  },
  images: [],
  auction: null,
  live_media: null,
};

function renderForm(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/merchant/products/new" element={<ProductForm />} />
        <Route path="/merchant/products/:id/edit" element={<ProductForm />} />
        <Route path="/merchant/products" element={<div>商品列表</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function file(name: string, type: string, size = 12) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('ProductForm live media', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-live-media'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('uploads pending live media after creating a new product', async () => {
    mocks.createProduct.mockResolvedValueOnce({
      ...draftDetail,
      product: { ...draftDetail.product, id: 41, title: '水乳套装' },
    });
    mocks.uploadProductImage.mockResolvedValueOnce('/static/images/product.webp');
    mocks.uploadProductLiveMedia.mockResolvedValueOnce({
      product_id: 41,
      type: 'video',
      url: '/static/live-media/room.mp4',
      poster_url: null,
    });
    mocks.publishProduct.mockResolvedValueOnce({ ...draftDetail, product: { ...draftDetail.product, id: 41 } });

    const { container } = renderForm('/merchant/products/new');
    fireEvent.change(screen.getByPlaceholderText('请输入商品名称'), { target: { value: '水乳套装' } });

    const imageInput = container.querySelector<HTMLInputElement>('input[accept="image/jpeg,image/png,image/webp"]');
    expect(imageInput).not.toBeNull();
    fireEvent.change(imageInput!, { target: { files: [file('product.webp', 'image/webp')] } });
    fireEvent.change(screen.getByLabelText('上传直播间素材'), { target: { files: [file('room.mp4', 'video/mp4')] } });

    fireEvent.click(screen.getByRole('button', { name: '创建草稿' }));

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledWith('水乳套装', '', []));
    expect(mocks.uploadProductImage).toHaveBeenCalledWith(41, expect.any(File));
    expect(mocks.uploadProductLiveMedia).toHaveBeenCalledWith(41, expect.any(File));
    expect(mocks.publishProduct).toHaveBeenCalledWith(41, expect.objectContaining({ duration_seconds: 300 }));
    expect(await screen.findByText('商品列表')).toBeInTheDocument();
  });

  it('uploads live media immediately while editing a draft product', async () => {
    mocks.getProduct.mockResolvedValueOnce(draftDetail);
    mocks.uploadProductLiveMedia.mockResolvedValueOnce({
      product_id: 33,
      type: 'image',
      url: '/static/live-media/room.webp',
      poster_url: null,
    });

    renderForm('/merchant/products/33/edit');

    fireEvent.change(await screen.findByLabelText('上传直播间素材'), {
      target: { files: [file('room.webp', 'image/webp')] },
    });

    await waitFor(() => expect(mocks.uploadProductLiveMedia).toHaveBeenCalledWith(33, expect.any(File)));
    expect(await screen.findByAltText('直播间素材预览')).toHaveAttribute('src', '/static/live-media/room.webp');
  });

  it('deletes existing live media for a draft product', async () => {
    mocks.getProduct.mockResolvedValueOnce({
      ...draftDetail,
      live_media: {
        product_id: 33,
        type: 'image',
        url: '/static/live-media/old.webp',
        poster_url: null,
      },
    });
    mocks.deleteProductLiveMedia.mockResolvedValueOnce(undefined);

    renderForm('/merchant/products/33/edit');

    fireEvent.click(await screen.findByRole('button', { name: '删除素材' }));

    await waitFor(() => expect(mocks.deleteProductLiveMedia).toHaveBeenCalledWith(33));
    expect(screen.queryByAltText('直播间素材预览')).not.toBeInTheDocument();
  });

  it('keeps live media readonly after the product leaves draft', async () => {
    mocks.getProduct.mockResolvedValueOnce({
      ...draftDetail,
      product: { ...draftDetail.product, status: 'active' },
      live_media: {
        product_id: 33,
        type: 'image',
        url: '/static/live-media/active.webp',
        poster_url: null,
      },
    });

    renderForm('/merchant/products/33/edit');

    expect(await screen.findByAltText('直播间素材预览')).toHaveAttribute('src', '/static/live-media/active.webp');
    expect(screen.queryByLabelText('上传直播间素材')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除素材' })).not.toBeInTheDocument();
  });

  it('shows a local validation error for unsupported live media files', async () => {
    renderForm('/merchant/products/new');

    fireEvent.change(screen.getByLabelText('上传直播间素材'), { target: { files: [file('notes.txt', 'text/plain')] } });

    expect(screen.getByText((text) => text.includes('仅支持 jpg/png/webp/mp4/webm'))).toBeInTheDocument();
    expect(mocks.uploadProductLiveMedia).not.toHaveBeenCalled();
  });
});
