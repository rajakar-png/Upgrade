import Link from 'next/link';
import { ServerStatus } from './ServerStatus';
import { Card } from '@/components/ui/Card';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

interface Plan {
  name: string;
  ram: number;
  cpu: number;
  storage: number;
}

interface Server {
  id: number;
  name: string;
  pterodactylServerId: string;
  status: string;
  expiresAt: string;
  planCoin?: Plan | null;
  planReal?: Plan | null;
}

interface ServerCardProps {
  server: Server;
}

export function ServerCard({ server }: ServerCardProps) {
  const plan = server.planCoin || server.planReal;
  const expiresAt = new Date(server.expiresAt);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);

  return (
    <Link href={`/servers/${server.id}`}>
      <Card className="group flex flex-col gap-4 p-5 cursor-pointer hover:border-[#ff7a18]/20">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold group-hover:text-orange-300 transition-colors">{server.name}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{plan?.name ?? 'Unknown Plan'}</p>
          </div>
          <ServerStatus status={server.status} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-2.5">
            <MemoryStick className="h-3.5 w-3.5 text-[#ff7a18]" />
            <p className="font-semibold">{plan?.ram ?? '—'} GB</p>
            <p className="text-gray-500">RAM</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-2.5">
            <Cpu className="h-3.5 w-3.5 text-green-400" />
            <p className="font-semibold">{plan?.cpu ?? '—'}%</p>
            <p className="text-gray-500">CPU</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] py-2.5">
            <HardDrive className="h-3.5 w-3.5 text-purple-400" />
            <p className="font-semibold">{plan?.storage ?? '—'} GB</p>
            <p className="text-gray-500">Disk</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className={`text-xs ${daysLeft <= 3 ? 'text-red-400' : 'text-gray-500'}`}>
            {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'}
          </p>
          <span className="text-xs font-medium text-[#ff7a18] group-hover:text-orange-300 transition-colors">
            Manage &rarr;
          </span>
        </div>
      </Card>
    </Link>
  );
}
