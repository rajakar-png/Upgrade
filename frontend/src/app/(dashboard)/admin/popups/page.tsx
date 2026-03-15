'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, Pencil, Upload, X } from 'lucide-react';

interface Popup {
  id: number;
  title: string;
  message: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  enabled: boolean;
  showOnce: boolean;
  sortOrder: number;
}

const empty: Omit<Popup, 'id'> = {
  title: '',
  message: '',
  imageUrl: null,
  imageAlt: '',
  enabled: true,
  showOnce: false,
  sortOrder: 0,
};

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [editing, setEditing] = useState<Partial<Popup> | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    api.get<Popup[]>('/admin/popups').then((r) => setPopups(r.data)).catch(() => toast.error('Failed to load popups'));
  }

  useEffect(load, []);

  function openForm(popup?: Popup) {
    setEditing(popup ? { ...popup } : { ...empty });
    setImageFile(null);
    setImagePreview(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', editing.title || '');
      form.append('message', editing.message || '');
      form.append('enabled', String(!!editing.enabled));
      form.append('showOnce', String(!!editing.showOnce));
      form.append('sortOrder', String(editing.sortOrder ?? 0));
      form.append('imageAlt', editing.imageAlt || '');
      if (imageFile) form.append('image', imageFile);

      if (editing.id) {
        await api.put(`/admin/popups/${editing.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/popups', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      toast.success(editing.id ? 'Popup updated' : 'Popup created');
      setEditing(null);
      load();
    } catch {
      toast.error('Failed to save popup');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this popup?')) return;
    try {
      await api.delete(`/admin/popups/${id}`);
      toast.success('Popup deleted');
      load();
    } catch {
      toast.error('Failed to delete popup');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Popup Messages</h1>
        <Button size="sm" onClick={() => openForm()} className="gap-2">
          <Plus className="h-4 w-4" /> New Popup
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {popups.length === 0 && <p className="text-sm text-gray-500">No popups yet.</p>}
        {popups.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            {p.imageUrl && (
              <img src={p.imageUrl} alt={p.imageAlt || p.title} className="h-14 w-14 rounded-lg object-cover border border-white/10" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.title}</p>
              <p className="text-sm text-gray-400 truncate">{p.message}</p>
              <div className="mt-1 flex gap-2 text-xs text-gray-500">
                <span className={p.enabled ? 'text-green-400' : 'text-red-400'}>{p.enabled ? 'Enabled' : 'Disabled'}</span>
                {p.showOnce && <span>· Show once</span>}
                <span>· Order: {p.sortOrder}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openForm(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-[#161616] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Popup' : 'New Popup'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <Input label="Title" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">Message</label>
              <textarea
                rows={3}
                value={editing.message || ''}
                onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-[#ff7a18]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7a18]/20"
              />
            </div>

            {/* Image */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Image (optional)</label>
              {(imagePreview || editing.imageUrl) && (
                <img src={imagePreview || editing.imageUrl || ''} alt={editing.imageAlt || editing.title || 'Popup image'} className="mb-2 h-24 rounded-lg object-cover border border-white/10" />
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Upload Image
              </Button>
            </div>

            <Input
              label="Image ALT Text"
              value={editing.imageAlt || ''}
              onChange={(e) => setEditing({ ...editing, imageAlt: e.target.value })}
              placeholder="Short descriptive ALT text"
            />

            <Input label="Sort Order" type="number" value={String(editing.sortOrder ?? 0)} onChange={(e) => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })} />

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]" />
                <span className="text-sm text-gray-300">Enabled</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.showOnce} onChange={(e) => setEditing({ ...editing, showOnce: e.target.checked })} className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#ff7a18] focus:ring-[#ff7a18]" />
                <span className="text-sm text-gray-300">Show Once</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={save} className="flex-1" disabled={saving}>{saving ? 'Saving…' : editing.id ? 'Update' : 'Create'}</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
