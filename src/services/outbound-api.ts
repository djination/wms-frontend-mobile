import { CompleteOutboundTaskPayload, OutboundTaskSummary } from '../types/outbound';

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

export async function listOutboundTasks(apiUrl: string, token: string): Promise<OutboundTaskSummary[]> {
  const res = await fetch(`${apiUrl}/outbound/tasks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | OutboundTaskSummary[] | null;
  if (!res.ok) throw parseError(Array.isArray(raw) ? null : raw, `Gagal mengambil task outbound (${res.status})`);
  if (!Array.isArray(raw)) return [];
  return raw;
}

export async function completeOutboundTask(
  apiUrl: string,
  token: string,
  taskId: string,
  payload: CompleteOutboundTaskPayload,
) {
  const res = await fetch(`${apiUrl}/outbound/tasks/${taskId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | Record<string, unknown> | null;
  if (!res.ok) throw parseError(raw as ApiErrorBody | null, `Gagal complete task outbound (${res.status})`);
  return raw;
}
