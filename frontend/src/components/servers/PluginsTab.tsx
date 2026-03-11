'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import {
  Search, Download, Loader2, ChevronLeft, ChevronRight, Package, Puzzle,
  TrendingUp, Filter, AlertTriangle, ArrowUpCircle,
} from 'lucide-react';

interface Props {
  serverId: number;
  serverVersion?: string;
}

type ContentType = 'plugin' | 'mod';
type Source = 'modrinth' | 'curseforge';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  icon_url: string;
  categories: string[];
  source: Source;
  slug: string;
}

interface ProjectVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  download_url: string;
  filename: string;
  size: number;
}

const CATEGORIES = {
  plugin: ['All', 'Economy', 'Chat', 'Protection', 'Admin', 'Fun', 'World', 'Misc'],
  mod: ['All', 'Adventure', 'Technology', 'Magic', 'Optimization', 'Library', 'Storage', 'World Gen', 'Misc'],
};

const PER_PAGE = 20;

export function PluginsTab({ serverId, serverVersion }: Props) {
  const [contentType, setContentType] = useState<ContentType>('plugin');
  const [source, setSource] = useState<Source>('modrinth');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProject, setSelectedProject] = useState<SearchResult | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load trending on mount
  useEffect(() => {
    searchProjects('', 'All', 0);
  }, [contentType, source]);

  const searchProjects = useCallback(async (q: string, cat: string, pg: number) => {
    setLoading(true);
    try {
      if (source === 'modrinth') {
        const facets: string[][] = [];
        facets.push([`project_type:${contentType === 'plugin' ? 'plugin' : 'mod'}`]);
        if (cat !== 'All') facets.push([`categories:${cat.toLowerCase()}`]);
        if (serverVersion) facets.push([`versions:${serverVersion}`]);

        const params = new URLSearchParams({
          query: q,
          facets: JSON.stringify(facets),
          limit: String(PER_PAGE),
          offset: String(pg * PER_PAGE),
          index: q ? 'relevance' : 'downloads',
        });

        const res = await fetch(`https://api.modrinth.com/v2/search?${params}`);
        const data = await res.json();

        setResults((data.hits || []).map((h: any) => ({
          id: h.project_id,
          title: h.title,
          description: h.description,
          author: h.author,
          downloads: h.downloads,
          icon_url: h.icon_url || '',
          categories: h.categories || [],
          source: 'modrinth' as Source,
          slug: h.slug,
        })));
        setTotalPages(Math.ceil((data.total_hits || 0) / PER_PAGE));
      } else {
        // CurseForge
        const cfClassId = contentType === 'plugin' ? 5 : 6; // Bukkit plugins = 5, Mods = 6
        const params: Record<string, string> = {
          gameId: '432',
          classId: String(cfClassId),
          searchFilter: q,
          pageSize: String(PER_PAGE),
          index: String(pg * PER_PAGE),
          sortField: q ? '2' : '6', // 2 = relevance, 6 = total downloads
          sortOrder: 'desc',
        };
        if (serverVersion) params.gameVersion = serverVersion;

        const qs = new URLSearchParams(params);
        const res = await fetch(`https://api.curseforge.com/v1/mods/search?${qs}`, {
          headers: { 'x-api-key': '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm' },
        });
        const data = await res.json();

        setResults((data.data || []).map((m: any) => ({
          id: String(m.id),
          title: m.name,
          description: m.summary,
          author: m.authors?.[0]?.name || 'Unknown',
          downloads: m.downloadCount,
          icon_url: m.logo?.thumbnailUrl || '',
          categories: m.categories?.map((c: any) => c.name) || [],
          source: 'curseforge' as Source,
          slug: m.slug,
        })));
        setTotalPages(Math.ceil((data.pagination?.totalCount || 0) / PER_PAGE));
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [source, contentType, serverVersion]);

  const doSearch = (pg = 0) => {
    setPage(pg);
    setSelectedProject(null);
    searchProjects(query, category, pg);
  };

  const loadVersions = async (project: SearchResult) => {
    setSelectedProject(project);
    setLoadingVersions(true);
    try {
      if (project.source === 'modrinth') {
        const res = await fetch(`https://api.modrinth.com/v2/project/${project.id}/version`);
        const data = await res.json();
        setVersions((data || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          version_number: v.version_number,
          game_versions: v.game_versions || [],
          loaders: v.loaders || [],
          download_url: v.files?.[0]?.url || '',
          filename: v.files?.[0]?.filename || '',
          size: v.files?.[0]?.size || 0,
        })));
      } else {
        const res = await fetch(`https://api.curseforge.com/v1/mods/${project.id}/files?pageSize=50`, {
          headers: { 'x-api-key': '$2a$10$bL4bIL5pUWqfcO7KQtnMReakwtfHbNKh6v1uTpKlzhwoueEJQnPnm' },
        });
        const data = await res.json();
        setVersions((data.data || []).map((f: any) => ({
          id: String(f.id),
          name: f.displayName,
          version_number: f.displayName,
          game_versions: f.gameVersions || [],
          loaders: [],
          download_url: f.downloadUrl || '',
          filename: f.fileName || '',
          size: f.fileLength || 0,
        })));
      }
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoadingVersions(false);
    }
  };

  const installVersion = async (v: ProjectVersion) => {
    // Unused — downloadAndInstall is the active function
  };

  const downloadAndInstall = async (v: ProjectVersion) => {
    if (!v.download_url) {
      toast.error('No download URL available');
      return;
    }
    setInstalling(v.id);
    try {
      const targetDir = contentType === 'plugin' ? '/plugins' : '/mods';

      await api.post(`/servers/${serverId}/manage/plugins/install`, {
        downloadUrl: v.download_url,
        filename: v.filename,
        directory: targetDir,
      });

      toast.success(`Installed ${v.filename}! Restart your server to apply.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Installation failed');
    } finally {
      setInstalling(null);
    }
  };

  const isCompatible = (v: ProjectVersion) => {
    if (!serverVersion) return true;
    return v.game_versions.length === 0 || v.game_versions.includes(serverVersion);
  };

  const formatDownloads = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  // ── Project Version View ──
  if (selectedProject) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedProject(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to search
        </button>

        <div className="flex items-center gap-3">
          {selectedProject.icon_url && (
            <img src={selectedProject.icon_url} alt="" className="h-12 w-12 rounded-xl" />
          )}
          <div>
            <h3 className="font-semibold text-lg">{selectedProject.title}</h3>
            <p className="text-xs text-gray-500">by {selectedProject.author} · {formatDownloads(selectedProject.downloads)} downloads</p>
          </div>
        </div>

        {serverVersion && (
          <p className="text-xs text-gray-500">
            Your server version: <span className="text-[#ff7a18] font-medium">{serverVersion}</span>
          </p>
        )}

        {loadingVersions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No versions found</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {versions.map((v) => {
              const compatible = isCompatible(v);
              return (
                <div
                  key={v.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3',
                    compatible
                      ? 'border-white/[0.06] bg-white/[0.02]'
                      : 'border-yellow-500/20 bg-yellow-500/5',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{v.name}</p>
                      {!compatible && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
                          <AlertTriangle className="h-3 w-3" /> Incompatible
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {v.game_versions.slice(0, 5).map((gv) => (
                        <span key={gv} className={cn(
                          'rounded px-1.5 py-0.5 text-[10px]',
                          gv === serverVersion
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-white/[0.05] text-gray-500',
                        )}>
                          {gv}
                        </span>
                      ))}
                      {v.game_versions.length > 5 && (
                        <span className="text-[10px] text-gray-600">+{v.game_versions.length - 5} more</span>
                      )}
                    </div>
                    {!compatible && serverVersion && v.game_versions.length > 0 && (
                      <p className="mt-1 text-[10px] text-yellow-500/80">
                        Requires: {v.game_versions.slice(0, 3).join(', ')}
                        {v.game_versions.length > 3 ? '…' : ''}
                        {' — '}
                        Consider upgrading/downgrading your server to match.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.size > 0 && (
                      <span className="text-[10px] text-gray-600">{(v.size / 1024 / 1024).toFixed(1)} MB</span>
                    )}
                    <Button
                      size="sm"
                      onClick={() => downloadAndInstall(v)}
                      disabled={installing === v.id}
                    >
                      {installing === v.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Search View ──
  return (
    <div className="space-y-4">
      {/* Type & Source Switcher */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => { setContentType('plugin'); setCategory('All'); }}
            className={cn('px-4 py-2 text-sm font-medium transition-colors',
              contentType === 'plugin' ? 'bg-[#ff7a18] text-white' : 'text-gray-400 hover:text-white')}
          >
            <Puzzle className="mr-1.5 h-3.5 w-3.5 inline" /> Plugins
          </button>
          <button
            onClick={() => { setContentType('mod'); setCategory('All'); }}
            className={cn('px-4 py-2 text-sm font-medium transition-colors',
              contentType === 'mod' ? 'bg-[#ff7a18] text-white' : 'text-gray-400 hover:text-white')}
          >
            <Package className="mr-1.5 h-3.5 w-3.5 inline" /> Mods
          </button>
        </div>
        <div className="flex rounded-xl border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setSource('modrinth')}
            className={cn('px-3 py-2 text-xs font-medium transition-colors',
              source === 'modrinth' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white')}
          >
            Modrinth
          </button>
          <button
            onClick={() => setSource('curseforge')}
            className={cn('px-3 py-2 text-xs font-medium transition-colors',
              source === 'curseforge' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white')}
          >
            CurseForge
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder={`Search ${contentType}s…`}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#ff7a18]/50"
          />
        </div>
        <Button onClick={() => doSearch()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES[contentType].map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); doSearch(0); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              category === cat
                ? 'bg-[#ff7a18] text-white'
                : 'bg-white/[0.05] text-gray-400 hover:text-white hover:bg-white/[0.08]',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Trending header */}
      {!query && !loading && results.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Trending {contentType}s</span>
        </div>
      )}

      {/* Results */}
      {loading && results.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : results.length === 0 && !initialLoad ? (
        <p className="text-sm text-gray-500 py-12 text-center">No {contentType}s found. Try a different search.</p>
      ) : (
        <div className="grid gap-2">
          {results.map((r) => (
            <button
              key={`${r.source}-${r.id}`}
              onClick={() => loadVersions(r)}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left hover:border-white/10 hover:bg-white/[0.04] transition-colors"
            >
              {r.icon_url ? (
                <img src={r.icon_url} alt="" className="h-10 w-10 rounded-lg shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  {contentType === 'plugin' ? <Puzzle className="h-5 w-5 text-gray-500" /> : <Package className="h-5 w-5 text-gray-500" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{r.title}</p>
                <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-600">by {r.author}</span>
                  <span className="text-[10px] text-gray-600">·</span>
                  <span className="text-[10px] text-gray-600">{formatDownloads(r.downloads)} downloads</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => doSearch(page - 1)} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
          <Button variant="ghost" size="sm" onClick={() => doSearch(page + 1)} disabled={page >= totalPages - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
