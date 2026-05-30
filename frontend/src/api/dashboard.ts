import client from './client';
import type { MerchantDashboard } from '../types/dashboard';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function envelopeData(value: unknown): unknown {
  return isRecord(value) ? value.data : undefined;
}

export async function getMerchantDashboard(): Promise<MerchantDashboard> {
  const { data } = await client.get('/merchant/dashboard');
  return envelopeData(data) as MerchantDashboard;
}
