import { ReceiveInboundPayload } from '../types/inbound';
import { InboundAsnSummary } from '../types/inbound';

type ApiErrorBody = {
  message?: string | string[];
};

export async function receiveInbound(apiUrl: string, token: string, payload: ReceiveInboundPayload) {
  const res = await fetch(`${apiUrl}/inbound/receive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = (await res.json().catch(() => null)) as ApiErrorBody | null;
  if (!res.ok) {
    if (raw?.message) {
      if (Array.isArray(raw.message) && raw.message.length > 0) {
        throw new Error(raw.message.join(', '));
      }
      if (typeof raw.message === 'string') {
        throw new Error(raw.message);
      }
    }
    throw new Error(`Gagal receive inbound (${res.status})`);
  }
  return raw;
}

export async function listInboundAsns(apiUrl: string, token: string): Promise<InboundAsnSummary[]> {
  const res = await fetch(`${apiUrl}/inbound/asns`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const raw = (await res.json().catch(() => null)) as ApiErrorBody | InboundAsnSummary[] | null;
  if (!res.ok) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.message) {
      if (Array.isArray(raw.message) && raw.message.length > 0) {
        throw new Error(raw.message.join(', '));
      }
      if (typeof raw.message === 'string') {
        throw new Error(raw.message);
      }
    }
    throw new Error(`Gagal mengambil daftar ASN (${res.status})`);
  }
  if (!Array.isArray(raw)) return [];
  return raw;
}
