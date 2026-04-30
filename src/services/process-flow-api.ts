import { InternalTransferSummary } from '../types/process-flow';

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

export async function listInternalTransfers(apiUrl: string, token: string): Promise<InternalTransferSummary[]> {
  const res = await fetch(`${apiUrl}/process-flow/transfers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | InternalTransferSummary[] | null;
  if (!res.ok) throw parseError(Array.isArray(raw) ? null : raw, `Gagal mengambil transfer internal (${res.status})`);
  if (!Array.isArray(raw)) return [];
  return raw;
}

export async function completeInternalTransfer(apiUrl: string, token: string, transferId: string) {
  const res = await fetch(`${apiUrl}/process-flow/transfers/${transferId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
  if (!res.ok) throw parseError(raw as ApiErrorBody | null, `Gagal complete internal transfer (${res.status})`);
  return raw;
}
