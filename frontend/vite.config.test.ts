import { describe, expect, it } from 'vitest';
import config from './vite.config';

describe('vite dev proxy', () => {
  it('proxies websocket room connections to the backend', () => {
    expect(config).toMatchObject({
      server: {
        proxy: {
          '/ws': {
            target: 'http://localhost:8080',
            ws: true,
          },
        },
      },
    });
  });
});
