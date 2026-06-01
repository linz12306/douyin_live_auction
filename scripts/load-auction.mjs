#!/usr/bin/env node

const defaults = {
  baseURL: process.env.LOAD_AUCTION_BASE_URL ?? 'http://127.0.0.1:8080',
  auctionID: process.env.LOAD_AUCTION_ID ?? '',
  tokens: process.env.LOAD_AUCTION_TOKENS ?? '',
  requests: 50,
  concurrency: 10,
  startAmount: 100,
  bidStep: 1,
  wsConnections: 0,
};

function usage() {
  return `Usage:
  node scripts/load-auction.mjs --auction-id <id> --tokens <tokenA,tokenB> [options]

Options:
  --base-url <url>          Backend base URL. Default: ${defaults.baseURL}
  --auction-id <id>         Active auction id. Env: LOAD_AUCTION_ID
  --tokens <csv>            Comma-separated user JWT access tokens. Env: LOAD_AUCTION_TOKENS
  --requests <n>            Total bid requests to send. Default: ${defaults.requests}
  --concurrency <n>         Concurrent bid workers. Default: ${defaults.concurrency}
  --start-amount <n>        First bid amount. Default: ${defaults.startAmount}
  --bid-step <n>            Amount increment per request. Default: ${defaults.bidStep}
  --ws-connections <n>      Optional WebSocket room connections. Default: ${defaults.wsConnections}
  --help                    Print this help without contacting the backend.

Example:
  LOAD_AUCTION_TOKENS="tokenA,tokenB,tokenC" \\
    node scripts/load-auction.mjs --auction-id 42 --requests 100 --concurrency 20 --start-amount 200 --bid-step 5 --ws-connections 10

After the run, inspect:
  curl ${defaults.baseURL}/healthz
`;
}

function parseArgs(argv) {
  const options = { ...defaults };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    i += 1;
    switch (key) {
      case 'base-url':
        options.baseURL = value;
        break;
      case 'auction-id':
        options.auctionID = value;
        break;
      case 'tokens':
        options.tokens = value;
        break;
      case 'requests':
        options.requests = positiveInt(value, key);
        break;
      case 'concurrency':
        options.concurrency = positiveInt(value, key);
        break;
      case 'start-amount':
        options.startAmount = positiveNumber(value, key);
        break;
      case 'bid-step':
        options.bidStep = positiveNumber(value, key);
        break;
      case 'ws-connections':
        options.wsConnections = nonNegativeInt(value, key);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsed;
}

function positiveNumber(value, name) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive number`);
  }
  return parsed;
}

function normalizeRunOptions(options) {
  const tokens = options.tokens
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (!options.auctionID) {
    throw new Error('--auction-id is required');
  }
  if (tokens.length === 0) {
    throw new Error('--tokens or LOAD_AUCTION_TOKENS is required');
  }
  return {
    ...options,
    baseURL: options.baseURL.replace(/\/+$/, ''),
    tokens,
    concurrency: Math.min(options.concurrency, options.requests),
  };
}

async function openWebSockets(options) {
  if (options.wsConnections === 0) {
    return [];
  }
  if (typeof WebSocket === 'undefined') {
    console.warn('WebSocket is not available in this Node runtime; skipping WS connections.');
    return [];
  }

  const wsURL = new URL(`/ws/auctions/${options.auctionID}`, options.baseURL);
  wsURL.protocol = wsURL.protocol === 'https:' ? 'wss:' : 'ws:';

  const sockets = [];
  await Promise.all(
    Array.from({ length: options.wsConnections }, (_, index) => {
      const token = options.tokens[index % options.tokens.length];
      const url = new URL(wsURL);
      url.searchParams.set('token', token);
      return new Promise((resolve) => {
        const socket = new WebSocket(url);
        const timeout = setTimeout(() => {
          console.warn(`WS ${index + 1} did not open within 3s; continuing.`);
          resolve();
        }, 3000);
        socket.addEventListener('open', () => {
          clearTimeout(timeout);
          sockets.push(socket);
          resolve();
        });
        socket.addEventListener('error', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }),
  );
  return sockets;
}

async function placeBid(options, requestIndex) {
  const token = options.tokens[requestIndex % options.tokens.length];
  const amount = Number((options.startAmount + requestIndex * options.bidStep).toFixed(2));
  const start = performance.now();
  const response = await fetch(`${options.baseURL}/api/v1/auctions/${options.auctionID}/bid`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount }),
  });
  const latencyMS = performance.now() - start;
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    amount,
    latencyMS,
    body: text,
  };
}

async function runLoad(options) {
  const sockets = await openWebSockets(options);
  let nextRequest = 0;
  const results = [];

  async function worker() {
    for (;;) {
      const requestIndex = nextRequest;
      nextRequest += 1;
      if (requestIndex >= options.requests) {
        return;
      }
      try {
        results.push(await placeBid(options, requestIndex));
      } catch (error) {
        results.push({ ok: false, status: 0, amount: 0, latencyMS: 0, body: String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  for (const socket of sockets) {
    socket.close();
  }

  return summarize(results, sockets.length);
}

function summarize(results, wsOpened) {
  const success = results.filter((result) => result.ok).length;
  const failure = results.length - success;
  const avgLatencyMS =
    results.length === 0 ? 0 : results.reduce((sum, result) => sum + result.latencyMS, 0) / results.length;
  const statuses = new Map();
  for (const result of results) {
    statuses.set(result.status, (statuses.get(result.status) ?? 0) + 1);
  }
  return {
    requests: results.length,
    success,
    failure,
    successRate: results.length === 0 ? 0 : success / results.length,
    avgLatencyMS,
    wsOpened,
    statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => Number(a) - Number(b))),
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }

  const options = normalizeRunOptions(parsed);
  console.log(
    `Running auction load: auction=${options.auctionID}, requests=${options.requests}, concurrency=${options.concurrency}, ws=${options.wsConnections}`,
  );
  const summary = await runLoad(options);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Inspect backend metrics: curl ${options.baseURL}/healthz`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
