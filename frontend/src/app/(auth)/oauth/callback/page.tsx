'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

function OAuthHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      login(token).then(() => {
        router.replace('/dashboard');
      });
    } else {
      router.replace('/login?error=oauth_failed');
    }
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
