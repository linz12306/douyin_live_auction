// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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
});
