// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuctionLobbyItem } from '../../types/auction';
import AuctionLobby from './AuctionLobby';

const mocks = vi.hoisted(() => ({
  listAuctionLobby: vi.fn(),
}));

vi.mock('../../api/auction', () => ({
  listAuctionLobby: mocks.listAuctionLobby,
}));

const activeItem: AuctionLobbyItem = {
  product_id: 12,
  auction_id: 9,
  title: '刚开拍的复古夹克',
  image_url: '/static/images/jacket.jpg',
  status: 'active',
  current_price: 30,
  ended_at: '2026-05-29T12:30:00.000Z',
};

function renderLobby() {
  return render(
    <MemoryRouter>
      <AuctionLobby />
    </MemoryRouter>,
  );
}

describe('AuctionLobby', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.listAuctionLobby.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('polls for newly activated auctions while the lobby stays open', async () => {
    mocks.listAuctionLobby
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activeItem]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('暂无可参与竞拍')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(mocks.listAuctionLobby).toHaveBeenCalledTimes(2);
    expect(screen.getByText('刚开拍的复古夹克')).toBeInTheDocument();
  });

  it('refreshes immediately when the page becomes visible again', async () => {
    mocks.listAuctionLobby
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activeItem]);

    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('暂无可参与竞拍')).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mocks.listAuctionLobby).toHaveBeenCalledTimes(2);
    expect(screen.getByText('刚开拍的复古夹克')).toBeInTheDocument();
    visibilitySpy.mockRestore();
  });

  it('filters loaded lobby items by local search text', async () => {
    mocks.listAuctionLobby.mockResolvedValueOnce([
      activeItem,
      { ...activeItem, auction_id: 10, product_id: 13, title: '金镶玉平安扣吊坠' },
    ]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('搜索直播、拍品或商家'), { target: { value: '平安扣' } });

    expect(screen.getByText('金镶玉平安扣吊坠')).toBeInTheDocument();
    expect(screen.queryByText('刚开拍的复古夹克')).not.toBeInTheDocument();
    expect(screen.getByText('本地筛选 · 1 个结果')).toBeInTheDocument();
  });

  it('renders discovery navigation and routes auction cards to live rooms', async () => {
    mocks.listAuctionLobby.mockResolvedValueOnce([activeItem]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '发现竞拍' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '订单' })).toHaveAttribute('href', '/app/orders');
    expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('link', { name: '进入直播：刚开拍的复古夹克' })).toHaveAttribute('href', '/app/auctions/9');
  });

  it('shows a filtered-empty state without implying backend search failed', async () => {
    mocks.listAuctionLobby.mockResolvedValueOnce([activeItem]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('搜索直播、拍品或商家'), { target: { value: '不存在的拍品' } });

    expect(screen.getByText('当前列表没有匹配内容')).toBeInTheDocument();
    expect(screen.getByText('这是本地筛选结果，可以换个关键词或回到推荐。')).toBeInTheDocument();
  });

  it('filters currently loaded items with discovery channel chips', async () => {
    mocks.listAuctionLobby.mockResolvedValueOnce([
      activeItem,
      { ...activeItem, auction_id: 10, product_id: 13, title: '即将开拍的银饰', status: 'pending' },
    ]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: '待开拍' }));

    expect(screen.getByRole('button', { name: '待开拍' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('即将开拍的银饰')).toBeInTheDocument();
    expect(screen.queryByText('刚开拍的复古夹克')).not.toBeInTheDocument();
  });

  it('filters active loaded items ending soon with the ending channel chip', async () => {
    vi.setSystemTime(new Date('2026-05-29T12:00:00.000Z'));
    mocks.listAuctionLobby.mockResolvedValueOnce([
      {
        ...activeItem,
        auction_id: 10,
        product_id: 13,
        title: '九分钟后落槌的腕表',
        ended_at: '2026-05-29T12:09:00.000Z',
      },
      {
        ...activeItem,
        auction_id: 11,
        product_id: 14,
        title: '半小时后结束的陶瓷',
        ended_at: '2026-05-29T12:30:00.000Z',
      },
    ]);

    renderLobby();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: '快结束' }));

    expect(screen.getByRole('button', { name: '快结束' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('九分钟后落槌的腕表')).toBeInTheDocument();
    expect(screen.queryByText('半小时后结束的陶瓷')).not.toBeInTheDocument();
  });
});
