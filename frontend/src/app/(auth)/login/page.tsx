'use client';

import { Button } from '@/components/ui/Button';
import { Chrome, MessageCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-gray-400">Sign in to your AstraNodes account</p>
      </div>

      <div className="space-y-3">
        <a href={`${API}/api/auth/google`} className="block">
          <Button variant="secondary" className="w-full gap-2 justify-center border-white/10 hover:border-white/20 hover:bg-white/[0.06]">
            <Chrome className="h-5 w-5" />
            Continue with Google
          </Button>
        </a>
        <a href={`${API}/api/auth/discord`} className="block">
          <Button variant="secondary" className="w-full gap-2 justify-center bg-[#5865F2]/90 hover:bg-[#5865F2] text-white border-[#5865F2]/50">
            <MessageCircle className="h-5 w-5" />
            Continue with Discord
          </Button>
        </a>
      </div>

      <p className="text-center text-xs text-gray-600">
        By continuing you agree to our Terms of Service.
      </p>
    </div>
  );
}
