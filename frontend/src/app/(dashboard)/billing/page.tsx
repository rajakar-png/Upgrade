'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface UpiDetails {
  upiId: string;
  qrUrl: string | null;
  instructions: string | null;
}

interface Submission {
  id: number;
  utrNumber: string;
  amount: number;
  status: string;
  screenshotUrl: string | null;
  createdAt: string;
}

const schema = z.object({
  utrNumber: z.string().min(6, 'Invalid UTR'),
  amount: z.number({ coerce: true }).positive('Must be positive'),
});
type FormValues = z.infer<typeof schema>;

const STATUS_STYLE: Record<string, string> = {
  pending: 'text-yellow-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
};

export default function BillingPage() {
  const [upi, setUpi] = useState<UpiDetails | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api.get<UpiDetails>('/billing/upi').then((r) => setUpi(r.data)).catch(() => {});
    api.get<Submission[]>('/billing/submissions').then((r) => setSubmissions(r.data)).catch(() => {});
  }, []);

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('utrNumber', data.utrNumber);
      fd.append('amount', String(data.amount));
      if (!file) {
        toast.error('Screenshot is required');
        setSubmitting(false);
        return;
      }
      fd.append('screenshot', file);

      const r = await api.post<Submission>('/billing/utr', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Submission received — admin will verify shortly');
      setSubmissions((prev) => [r.data, ...prev]);
      reset();
      setFile(null);
    } catch {
      toast.error('Failed to submit UTR');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">Pay via UPI and submit your UTR for balance top-up.</p>
      </div>

      {upi && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 font-semibold">Payment Details</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            {upi.qrUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={upi.qrUrl} alt="UPI QR" className="h-32 w-32 rounded-lg object-contain" />
            )}
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-400">UPI ID: </span>
                <span className="font-mono font-semibold">{upi.upiId}</span>
              </p>
              {upi.instructions && <p className="text-gray-400">{upi.instructions}</p>}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold">Submit Payment</h2>
        <Input
          label="UTR Number"
          placeholder="Enter 12-digit UTR"
          error={errors.utrNumber?.message}
          {...register('utrNumber')}
        />
        <Input
          label="Amount (INR)"
          type="number"
          placeholder="500"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <div>
          <label className="mb-1 block text-sm text-gray-300">Screenshot <span className="text-red-400">*</span></label>
          <input
            type="file"
            accept="image/*"
            required
            className="text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ff7a18] file:px-3 file:py-1.5 file:text-sm file:text-white"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit UTR'}
        </Button>
      </form>

      {submissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Past Submissions</h2>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-mono">{s.utrNumber}</p>
                  <p className="text-xs text-gray-400">
                    ₹{s.amount} · {new Date(s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-medium capitalize ${STATUS_STYLE[s.status] ?? 'text-gray-400'}`}>
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
