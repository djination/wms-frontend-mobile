import { InventoryBalanceSummary, UpsertInventoryPayload } from '../types/inventory';

type ApiErrorBody = {
  message?: string | string[];
};

function parseError(raw: ApiErrorBody | null, fallback: string): Error {
  if (raw?.message) {
    if (Array.isArray(raw.message) && raw.message.length > 0) return new Error(raw.message.join(', '));
    if (typeof raw.message === 'string') return new Error(raw.message);
  }
  return new Error(fallback);
}

export async function listInventoryBalances(apiUrl: string, token: string): Promise<InventoryBalanceSummary[]> {
  const res = await fetch(`${apiUrl}/master-data/inventory-balances`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | InventoryBalanceSummary[] | null;
  if (!res.ok) throw parseError(Array.isArray(raw) ? null : raw, `Gagal mengambil inventory balances (${res.status})`);
  if (!Array.isArray(raw)) return [];
  return raw;
}

export async function upsertInventoryBalance(apiUrl: string, token: string, payload: UpsertInventoryPayload) {
  const res = await fetch(`${apiUrl}/master-data/inventory-balances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
  if (!res.ok) throw parseError(raw as ApiErrorBody | null, `Gagal update inventory balance (${res.status})`);
  return raw;
}
