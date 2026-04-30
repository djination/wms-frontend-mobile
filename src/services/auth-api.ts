import { LoginResponse } from '../types/auth';

type ApiErrorBody = {
  message?: string;
};

export async function loginMobile(apiUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
      platform: 'mobile',
    }),
  });

  const raw = (await res.json().catch(() => null)) as LoginResponse | ApiErrorBody | null;
  if (!res.ok) {
    const message =
      raw && typeof raw === 'object' && 'message' in raw && typeof raw.message === 'string'
        ? raw.message
        : `Login gagal (${res.status})`;
    if (message.toLowerCase().includes('no mobile access')) {
      throw new Error('Akun ini tidak memiliki akses ke aplikasi mobile. Hubungi admin.');
    }
    throw new Error(message);
  }

  const accessToken = raw && typeof raw === 'object' && 'accessToken' in raw ? raw.accessToken : undefined;
  if (!accessToken) {
    throw new Error('Token tidak ditemukan dari API');
  }
  return accessToken;
}
