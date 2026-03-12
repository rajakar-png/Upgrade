'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { api } from '@/lib/api';

function OAuthHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const exchanged = useRef(false);

  useEffect(() => {
    const code = params.get('code');
    if (!code || exchanged.current) {
      if (!code) router.replace('/login?error=oauth_failed');
      return;
    }
    exchanged.current = true;

    api.post('/auth/exchange', { code })
      .then((res) => login(res.data.token))
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login?error=oauth_failed'));
  }, [params, router, login]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ff7a18] border-t-transparent" />
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthHandler />
    </Suspense>
  );
}
