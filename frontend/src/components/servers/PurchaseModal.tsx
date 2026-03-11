'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import {
  Globe, Server as ServerIcon, ChevronRight, ChevronLeft, MapPin, Egg, Loader2,
} from 'lucide-react';

interface Node {
  id: number;
  name: string;
  locationId: number;
  location: string;
  fqdn: string;
  freeAllocations: number;
}

interface EggOption {
  id: number;
  name: string;
  description: string;
  dockerImage: string;
}

interface Nest {
  nestId: number;
  nestName: string;
  nestDescription: string;
  category: 'minecraft' | 'bot';
  eggs: EggOption[];
}

type Step = 'name' | 'software' | 'node' | 'confirm';

interface PurchaseModalProps {
  open: boolean;
  onClose: () => void;
  plan: any | null;
  planType: 'coin' | 'real';
  category: 'minecraft' | 'bot';
}

export function PurchaseModal({ open, onClose, plan, planType, category }: PurchaseModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('name');
  const [serverName, setServerName] = useState(`my-${category}-server`);
  const [nests, setNests] = useState<Nest[]>([]);
  const [selectedEgg, setSelectedEgg] = useState<EggOption | null>(null);
  const [loadingEggs, setLoadingEggs] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('name');
      setServerName(`my-${category}-server`);
      setSelectedEgg(null);
      setSelectedNode(null);
    }
  }, [open, category]);

  // Load eggs when reaching software step
  useEffect(() => {
    if (step === 'software' && nests.length === 0) {
      setLoadingEggs(true);
      api.get<Nest[]>(`/servers/eggs?category=${category}`)
        .then((r) => {
          const data = r.data;
          setNests(data);
          // Auto-select first egg if available
          const firstEgg = data.flatMap((n) => n.eggs)[0];
          if (firstEgg && !selectedEgg) setSelectedEgg(firstEgg);
        })
        .catch(() => toast.error('Failed to load server software'))
        .finally(() => setLoadingEggs(false));
    }
  }, [step, nests.length, category]);

  // Load nodes when reaching node step
  useEffect(() => {
    if (step === 'node' && nodes.length === 0) {
      setLoadingNodes(true);
      api.get<Node[]>('/servers/nodes')
        .then((r) => setNodes(r.data))
        .catch(() => toast.error('Failed to load locations'))
        .finally(() => setLoadingNodes(false));
    }
  }, [step, nodes.length]);

  if (!plan) return null;

  const steps: Step[] = ['name', 'software', 'node', 'confirm'];
  const stepIndex = steps.indexOf(step);

  function nextStep() {
    if (step === 'name') {
      if (serverName.trim().length < 3) {
        toast.error('Server name must be at least 3 characters');
        return;
      }
      setStep('software');
    } else if (step === 'software') {
      if (!selectedEgg) {
        toast.error('Please select a server software');
        return;
      }
      setStep('node');
    } else if (step === 'node') {
      setStep('confirm');
    }
  }

  function prevStep() {
    if (step === 'software') setStep('name');
    else if (step === 'node') setStep('software');
    else if (step === 'confirm') setStep('node');
  }

  async function handlePurchase() {
    setPurchasing(true);
    try {
      await api.post('/servers/purchase', {
        planId: plan.id,
        planType,
        serverName: serverName.trim(),
        eggId: selectedEgg?.id,
        category,
        ...(selectedNode ? { nodeId: selectedNode } : {}),
      });
      toast.success('Server purchased! Redirecting…');
      onClose();
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  }

  const selectedNodeData = nodes.find((n) => n.id === selectedNode);
  const allEggs = nests.flatMap((n) => n.eggs);

  return (
    <Modal open={open} onClose={onClose} title="Create Server" className="max-w-lg">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              i <= stepIndex ? 'bg-[#ff7a18] text-white' : 'bg-white/10 text-gray-500',
            )}>
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-px w-6', i < stepIndex ? 'bg-[#ff7a18]' : 'bg-white/10')} />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-gray-500 capitalize">{step}</span>
      </div>

      {/* ─── Step 1: Server Name ─── */}
      {step === 'name' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Choose a name for your server.</p>
          <Input
            label="Server Name"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="my-minecraft-server"
            autoFocus
          />
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-gray-500 mb-2">Plan</p>
            <p className="font-semibold text-white">{plan.name}</p>
            <div className="mt-2 flex gap-3 text-xs text-gray-400">
              <span>{plan.ram} GB RAM</span>
              <span>{plan.cpu}% CPU</span>
              <span>{plan.storage} GB Storage</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 2: Software ─── */}
      {step === 'software' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Select the server software to install.</p>
          {loadingEggs ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff7a18]" />
              <p className="text-sm text-gray-500">Loading available software…</p>
            </div>
          ) : allEggs.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-gray-400 text-sm">No server software available for this category.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {nests.map((nest) => (
                <div key={nest.nestId}>
                  {nests.length > 1 && (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {nest.nestName}
                    </p>
                  )}
                  <div className="grid gap-2">
                    {nest.eggs.map((egg) => (
                      <button
                        key={egg.id}
                        onClick={() => setSelectedEgg(egg)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                          selectedEgg?.id === egg.id
                            ? 'border-[#ff7a18] bg-[#ff7a18]/10 text-white'
                            : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20 hover:bg-white/[0.04]',
                        )}
                      >
                        <div className={cn(
                          'rounded-lg p-2',
                          selectedEgg?.id === egg.id ? 'bg-[#ff7a18]/20 text-[#ff7a18]' : 'bg-white/[0.06] text-gray-400',
                        )}>
                          <Egg className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{egg.name}</p>
                          {egg.description && (
                            <p className="text-xs text-gray-500 truncate">{egg.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 3: Node / Location ─── */}
      {step === 'node' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Pick a server location closest to your players.</p>
          {loadingNodes ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03] border border-white/[0.06]" />
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-gray-400 text-sm">No nodes available. Auto-assignment will be used.</p>
            </div>
          ) : (
            <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
              {/* Auto-select option */}
              <button
                onClick={() => setSelectedNode(null)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  selectedNode === null
                    ? 'border-[#ff7a18] bg-[#ff7a18]/10 text-white'
                    : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20 hover:bg-white/[0.04]',
                )}
              >
                <div className={cn('rounded-lg p-2', selectedNode === null ? 'bg-[#ff7a18]/20 text-[#ff7a18]' : 'bg-white/[0.06] text-gray-400')}>
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Auto (Best Available)</p>
                  <p className="text-xs text-gray-500">Automatically picks the least loaded node</p>
                </div>
              </button>

              {nodes.map((node) => {
                const isFull = node.freeAllocations === 0;
                return (
                  <button
                    key={node.id}
                    onClick={() => !isFull && setSelectedNode(node.id)}
                    disabled={isFull}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                      selectedNode === node.id
                        ? 'border-[#ff7a18] bg-[#ff7a18]/10 text-white'
                        : isFull
                        ? 'border-white/5 bg-white/[0.01] text-gray-600 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/20 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className={cn(
                      'rounded-lg p-2',
                      selectedNode === node.id ? 'bg-[#ff7a18]/20 text-[#ff7a18]' : 'bg-white/[0.06] text-gray-400',
                    )}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{node.location}</p>
                      <p className="text-xs text-gray-500">{node.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-xs font-medium',
                        isFull ? 'text-red-400' : node.freeAllocations < 5 ? 'text-yellow-400' : 'text-green-400',
                      )}>
                        {isFull ? 'Full' : `${node.freeAllocations} ports available`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 4: Confirm ─── */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Review your server configuration before purchasing.</p>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] divide-y divide-white/[0.06]">
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Plan</span>
              <span className="text-sm font-medium text-white">{plan.name}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Server Name</span>
              <span className="text-sm font-medium text-white">{serverName}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Software</span>
              <span className="text-sm font-medium text-white">{selectedEgg?.name || 'Not selected'}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Location</span>
              <span className="text-sm font-medium text-white">{selectedNodeData?.location || 'Auto (Best Available)'}</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Resources</span>
              <span className="text-sm text-white">{plan.ram} GB / {plan.cpu}% / {plan.storage} GB</span>
            </div>
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-400">Price</span>
              <span className="text-sm font-bold text-[#ff7a18]">
                {planType === 'coin'
                  ? `${plan.initialPrice || plan.coinPrice} coins`
                  : `$${plan.price?.toFixed?.(2) || plan.price}`}
                {plan.durationDays > 0 ? ` / ${plan.durationDays}d` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <div className="mt-6 flex items-center justify-between">
        {stepIndex > 0 ? (
          <Button variant="ghost" size="sm" onClick={prevStep}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step === 'confirm' ? (
          <Button onClick={handlePurchase} disabled={purchasing}>
            {purchasing ? 'Creating Server…' : 'Confirm Purchase'}
          </Button>
        ) : (
          <Button onClick={nextStep}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </Modal>
  );
}
