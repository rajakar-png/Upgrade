'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

interface Props {
  serverId: number;
  open: boolean;
  onAccepted: () => void;
}

export function EulaModal({ serverId, open, onAccepted }: Props) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await api.post(`/servers/${serverId}/manage/eula/accept`);
      toast.success('EULA accepted — starting server…');
      // Give Wings a moment then start the server
      try {
        await api.post(`/servers/${serverId}/manage/power`, { action: 'start' });
      } catch {
        // Server might already be starting
      }
      onAccepted();
    } catch {
      toast.error('Failed to accept EULA');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => {}} title="" className="max-w-md">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff7a18]/10">
          <ShieldCheck className="h-7 w-7 text-[#ff7a18]" />
        </div>
        <h2 className="text-lg font-semibold text-white">Minecraft EULA</h2>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          To start your Minecraft server, you need to accept the{' '}
          <a
            href="https://aka.ms/MinecraftEULA"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff7a18] hover:underline"
          >
            Minecraft End User License Agreement
          </a>
          . By clicking Accept, you confirm that you agree to the terms.
        </p>
        <div className="mt-6 flex w-full gap-3">
          <Button className="flex-1" onClick={handleAccept} disabled={accepting}>
            {accepting ? 'Accepting…' : 'Accept EULA'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
