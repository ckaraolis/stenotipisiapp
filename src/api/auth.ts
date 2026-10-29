export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { errorCode?: string };
    throw new Error(body.errorCode ?? 'forgotPasswordError');
  }
}

export async function validateResetToken(token: string): Promise<{ email: string }> {
  const response = await fetch(
    `/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
  );

  if (!response.ok) {
    throw new Error('resetTokenInvalid');
  }

  return response.json() as Promise<{ email: string }>;
}

export async function resetPasswordWithToken(payload: {
  token: string;
  newPassword: string;
}): Promise<void> {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as { errors?: string[] };
  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }
}
