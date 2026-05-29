// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import PageBackButton from './PageBackButton';

function renderWithHistory() {
  return render(
    <MemoryRouter initialEntries={['/previous', '/current']} initialIndex={1}>
      <Routes>
        <Route path="/previous" element={<div>上一页内容</div>} />
        <Route
          path="/current"
          element={(
            <div>
              <PageBackButton fallback="/fallback" />
              <div>当前页内容</div>
            </div>
          )}
        />
        <Route path="/fallback" element={<div>兜底页内容</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDirectEntry() {
  return render(
    <MemoryRouter initialEntries={['/current']}>
      <Routes>
        <Route
          path="/current"
          element={(
            <div>
              <PageBackButton fallback="/fallback" />
              <div>当前页内容</div>
            </div>
          )}
        />
        <Route path="/fallback" element={<div>兜底页内容</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PageBackButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns to browser history when a previous page exists', () => {
    renderWithHistory();

    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));

    expect(screen.getByText('上一页内容')).toBeInTheDocument();
  });

  it('uses the fallback route on direct page entry', () => {
    renderDirectEntry();

    fireEvent.click(screen.getByRole('button', { name: '返回上一页' }));

    expect(screen.getByText('兜底页内容')).toBeInTheDocument();
  });
});
