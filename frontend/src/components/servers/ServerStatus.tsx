const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  suspended: { label: 'Suspended', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  expired: { label: 'Expired', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  pending: { label: 'Pending', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  installing: { label: 'Installing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  deleted: { label: 'Deleted', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

export function ServerStatus({ status }: { status: string }) {
  const map = STATUS_MAP[status.toLowerCase()] ?? { label: status, className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${map.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {map.label}
    </span>
  );
}
