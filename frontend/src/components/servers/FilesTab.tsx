'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  Folder, File, ArrowLeft, Plus, Save, X, Trash2, Upload, Edit3, FolderPlus, Loader2,
} from 'lucide-react';

interface FileItem {
  name: string;
  size: number;
  isFile: boolean;
  mimetype: string;
  modifiedAt: string;
}

interface Props {
  serverId: number;
}

export function FilesTab({ serverId }: Props) {
  const [cwd, setCwd] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchFiles = async (dir: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/files/list`, { params: { directory: dir } });
      setFiles(data);
      setCwd(dir);
      setSelected(new Set());
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles('/'); }, [serverId]);

  const navigate = (name: string) => {
    const path = cwd === '/' ? `/${name}` : `${cwd}/${name}`;
    fetchFiles(path);
  };

  const goUp = () => {
    if (cwd === '/') return;
    const parts = cwd.split('/').filter(Boolean);
    parts.pop();
    fetchFiles('/' + parts.join('/'));
  };

  const openFile = async (name: string) => {
    const path = cwd === '/' ? `/${name}` : `${cwd}/${name}`;
    try {
      const { data } = await api.get(`/servers/${serverId}/manage/files/contents`, { params: { file: path } });
      setEditing({ path, content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2) });
    } catch {
      toast.error('Cannot read this file');
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.post(`/servers/${serverId}/manage/files/write`, { file: editing.path, content: editing.content });
      toast.success('File saved');
      setEditing(null);
    } catch {
      toast.error('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      if (creating === 'folder') {
        await api.post(`/servers/${serverId}/manage/files/create-folder`, { root: cwd, name: newName.trim() });
      } else {
        const path = cwd === '/' ? `/${newName.trim()}` : `${cwd}/${newName.trim()}`;
        await api.post(`/servers/${serverId}/manage/files/write`, { file: path, content: '' });
      }
      toast.success(`${creating === 'folder' ? 'Folder' : 'File'} created`);
      setCreating(null);
      setNewName('');
      fetchFiles(cwd);
    } catch {
      toast.error('Failed to create');
    }
  };

  const handleRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    try {
      await api.put(`/servers/${serverId}/manage/files/rename`, { root: cwd, from: renaming, to: renameValue.trim() });
      toast.success('Renamed');
      setRenaming(null);
      fetchFiles(cwd);
    } catch {
      toast.error('Failed to rename');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.post(`/servers/${serverId}/manage/files/delete`, { root: cwd, files: [deleteTarget] });
      toast.success('Deleted');
      setDeleteTarget(null);
      fetchFiles(cwd);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    try {
      await api.post(`/servers/${serverId}/manage/files/delete`, { root: cwd, files: Array.from(selected) });
      toast.success(`Deleted ${selected.size} items`);
      setSelected(new Set());
      fetchFiles(cwd);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // ── Editor View ──
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <File className="h-4 w-4" />
            <span className="font-mono">{editing.path}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" onClick={saveFile} disabled={saving}>
              <Save className="mr-1 h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <textarea
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          className="h-[500px] w-full resize-none rounded-xl border border-white/[0.06] bg-black p-4 font-mono text-xs leading-5 text-gray-300 outline-none focus:border-[#ff7a18]/30"
          spellCheck={false}
        />
      </div>
    );
  }

  // ── File Browser View ──
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={goUp} disabled={cwd === '/'}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <span className="font-mono text-xs text-gray-500 truncate flex-1 min-w-0">{cwd}</span>
        <Button variant="ghost" size="sm" onClick={() => { setCreating('file'); setNewName(''); }}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New File
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setCreating('folder'); setNewName(''); }}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> New Folder
        </Button>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete ({selected.size})
          </Button>
        )}
      </div>

      {/* Create input */}
      {creating && (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={creating === 'folder' ? 'Folder name…' : 'File name…'}
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-white outline-none"
            autoFocus
          />
          <Button size="sm" onClick={handleCreate}>Create</Button>
          <Button variant="ghost" size="sm" onClick={() => setCreating(null)}>Cancel</Button>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">Empty directory</div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
          {/* Sort: folders first, then files */}
          {[...files]
            .sort((a, b) => (a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1))
            .map((f) => (
              <div
                key={f.name}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors group',
                  selected.has(f.name) && 'bg-[#ff7a18]/5',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.name)}
                  onChange={() => toggleSelect(f.name)}
                  className="h-3.5 w-3.5 rounded accent-[#ff7a18]"
                />
                <button
                  className="flex flex-1 items-center gap-3 min-w-0 text-left"
                  onClick={() => (f.isFile ? openFile(f.name) : navigate(f.name))}
                >
                  {f.isFile
                    ? <File className="h-4 w-4 shrink-0 text-gray-500" />
                    : <Folder className="h-4 w-4 shrink-0 text-[#ff7a18]" />
                  }
                  {renaming === f.name ? (
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded bg-white/[0.05] px-2 py-0.5 text-sm text-white outline-none"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm text-gray-300 truncate">{f.name}</span>
                  )}
                </button>
                <span className="text-xs text-gray-600 w-16 text-right">{f.isFile ? formatSize(f.size) : '—'}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setRenaming(f.name); setRenameValue(f.name); }}
                    className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white"
                    title="Rename"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(f.name)}
                    className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete"
        message={`Delete "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </div>
  );
}
