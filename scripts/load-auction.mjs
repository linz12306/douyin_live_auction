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
  loginUsers: '',
  verifyFinalState: false,
  bidMode: 'sync',
  commandPollMs: 100,
  commandTimeoutMs: 10000,
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
  --login-users <csv>       Login users as username:password pairs when --tokens is omitted.
  --bid-mode <sync|queued>  Use sync bid endpoint or async queued endpoint. Default: ${defaults.bidMode}
  --command-poll-ms <n>     Queued mode command polling interval. Default: ${defaults.commandPollMs}
  --command-timeout-ms <n>  Queued mode command polling timeout. Default: ${defaults.commandTimeoutMs}
  --verify-final-state      Print /healthz and ranking summary after the load run.
  --latency-percentiles     Accepted for readability; percentile latency is always printed.
  --help                    Print this help without contacting the backend.

Example:
  LOAD_AUCTION_TOKENS="tokenA,tokenB,tokenC" \\
    node scripts/load-auction.mjs --auction-id 42 --requests 100 --concurrency 20 --start-amount 200 --bid-step 5 --ws-connections 10

  node scripts/load-auction.mjs --auction-id 42 --login-users demo_buyer_a:test123,demo_buyer_b:test123 --requests 100 --concurrency 20 --verify-final-state

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
    if (arg === '--verify-final-state') {
      options.verifyFinalState = true;
      continue;
    }
    if (arg === '--latency-percentiles') {
      options.latencyPercentiles = true;
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
      case 'login-users':
        options.loginUsers = value;
        break;
      case 'bid-mode':
        if (!['sync', 'queued'].includes(value)) {
          throw new Error('--bid-mode must be sync or queued');
        }
        options.bidMode = value;
        break;
      case 'command-poll-ms':
        options.commandPollMs = positiveInt(value, key);
        break;
      case 'command-timeout-ms':
        options.commandTimeoutMs = positiveInt(value, key);
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

async function normalizeRunOptions(options) {
  let tokens = options.tokens
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0 && options.loginUsers.trim() !== '') {
    tokens = await loginUsers(options);
  }
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

async function loginUsers(options) {
  const pairs = options.loginUsers
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean);
  const tokens = [];
  for (const pair of pairs) {
    const separator = pair.indexOf(':');
    if (separator <= 0 || separator === pair.length - 1) {
      throw new Error(`Invalid --login-users entry: ${pair}`);
    }
    const username = pair.slice(0, separator);
    const password = pair.slice(separator + 1);
    const response = await fetch(`${options.baseURL.replace(/\/+$/, '')}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`Login failed for ${username}: ${response.status} ${text}`);
    }
    const token = body?.data?.access_token;
    if (!token) {
      throw new Error(`Login response for ${username} did not include access_token`);
    }
    tokens.push(token);
  }
  return tokens;
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
  const endpoint = options.bidMode === 'queued'
    ? `/api/v1/auctions/${options.auctionID}/bid/async`
    : `/api/v1/auctions/${options.auctionID}/bid`;
  const start = performance.now();
  const response = await fetch(`${options.baseURL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `load-${options.bidMode}-${Date.now()}-${requestIndex}`,
    },
    body: JSON.stringify({ amount }),
  });
  const latencyMS = performance.now() - start;
  const text = await response.text();
  let commandID = '';
  if (options.bidMode === 'queued' && text) {
    try {
      const body = JSON.parse(text);
      commandID = body?.data?.command_id ?? '';
    } catch {
      commandID = '';
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    amount,
    latencyMS,
    body: text,
    commandID,
    token,
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

  const summary = summarize(results, sockets.length, options);
  if (options.bidMode === 'queued') {
    summary.workerOutcomes = await pollCommandOutcomes(options, results);
  }
  if (options.verifyFinalState) {
    summary.finalState = await verifyFinalState(options);
  }
  return summary;
}

function summarize(results, wsOpened, options) {
  const success = results.filter((result) => result.ok).length;
  const failure = results.length - success;
  const latencies = results.map((result) => result.latencyMS).filter((latency) => Number.isFinite(latency));
  const avgLatencyMS =
    results.length === 0 ? 0 : results.reduce((sum, result) => sum + result.latencyMS, 0) / results.length;
  const statuses = new Map();
  for (const result of results) {
    statuses.set(result.status, (statuses.get(result.status) ?? 0) + 1);
  }
  return {
    requests: results.length,
    bidMode: options.bidMode,
    success,
    failure,
    successRate: results.length === 0 ? 0 : success / results.length,
    latencyMS: {
      avg: roundLatency(avgLatencyMS),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: roundLatency(latencies.length === 0 ? 0 : Math.max(...latencies)),
    },
    wsOpened,
    statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => Number(a) - Number(b))),
  };
}

async function pollCommandOutcomes(options, results) {
  const commandResults = results.filter((result) => result.ok && result.commandID);
  const deadline = performance.now() + options.commandTimeoutMs;
  const statuses = new Map();
  let maxLagMS = 0;

  const remaining = new Map(commandResults.map((result) => [result.commandID, result]));
  while (remaining.size > 0 && performance.now() < deadline) {
    await sleep(options.commandPollMs);
    await Promise.all([...remaining.entries()].map(async ([commandID, result]) => {
      try {
        const response = await fetch(`${options.baseURL}/api/v1/auctions/${options.auctionID}/bid-commands/${commandID}`, {
          headers: { Authorization: `Bearer ${result.token}` },
        });
        const body = await response.json();
        const command = body?.data;
        const status = command?.status ?? 'unknown';
        if (['accepted', 'rejected', 'failed'].includes(status)) {
          statuses.set(status, (statuses.get(status) ?? 0) + 1);
          const createdAt = Date.parse(command.created_at);
          const processedAt = Date.parse(command.processed_at ?? command.updated_at);
          if (Number.isFinite(createdAt) && Number.isFinite(processedAt)) {
            maxLagMS = Math.max(maxLagMS, processedAt - createdAt);
          }
          remaining.delete(commandID);
        }
      } catch {
        // Keep polling until timeout.
      }
    }));
  }

  for (const result of remaining.values()) {
    statuses.set('pending', (statuses.get('pending') ?? 0) + 1);
  }

  return {
    totalCommands: commandResults.length,
    statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a.localeCompare(b))),
    pending: remaining.size,
    queueLagMS: {
      max: roundLatency(maxLagMS),
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, pct) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return roundLatency(sorted[index]);
}

function roundLatency(value) {
  return Math.round(value * 100) / 100;
}

async function verifyFinalState(options) {
  const state = {
    healthAuctionEngine: null,
    rankingTop: null,
    sqlChecks: [
      `SELECT COUNT(*) FROM bids WHERE auction_id = ${options.auctionID} AND status = 'active';`,
      `SELECT COUNT(*) FROM orders WHERE auction_id = ${options.auctionID};`,
      `SELECT status, current_price, highest_bidder_id FROM auctions WHERE id = ${options.auctionID};`,
      `SELECT MIN(balance), MIN(frozen_amount) FROM users WHERE role = 'user';`,
    ],
  };

  try {
    const healthResponse = await fetch(`${options.baseURL}/healthz`);
    const healthBody = await healthResponse.json();
    state.healthAuctionEngine = healthBody?.components?.auction_engine ?? null;
  } catch (error) {
    state.healthError = String(error);
  }

  try {
    const rankingResponse = await fetch(`${options.baseURL}/api/v1/auctions/${options.auctionID}/rankings`, {
      headers: { Authorization: `Bearer ${options.tokens[0]}` },
    });
    const rankingBody = await rankingResponse.json();
    const items = rankingBody?.data?.items ?? [];
    state.rankingTop = items[0] ?? null;
  } catch (error) {
    state.rankingError = String(error);
  }

  return state;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }

  const options = await normalizeRunOptions(parsed);
  console.log(
    `Running auction load: auction=${options.auctionID}, mode=${options.bidMode}, requests=${options.requests}, concurrency=${options.concurrency}, ws=${options.wsConnections}`,
  );
  const summary = await runLoad(options);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Inspect backend metrics: curl ${options.baseURL}/healthz`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
