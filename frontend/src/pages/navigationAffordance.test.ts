import { describe, expect, it } from 'vitest';

const pageFiles = [
  'Login.tsx',
  'Register.tsx',
  'Profile.tsx',
  'merchant/ProductList.tsx',
  'merchant/ProductForm.tsx',
  'merchant/ProductDetail.tsx',
  'app/AuctionLobby.tsx',
  'app/LiveAuctionRoom.tsx',
];
const pageSources = import.meta.glob('./**/*.tsx', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

describe('page navigation affordance', () => {
  it.each(pageFiles)('%s uses the shared back button', (file) => {
    const source = pageSources[`./${file}`];

    expect(source).toContain('PageBackButton');
  });
});
