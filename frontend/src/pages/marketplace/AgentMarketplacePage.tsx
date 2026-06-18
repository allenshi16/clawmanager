import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import { useI18n } from '../../contexts/I18nContext';
import { agentVariantService } from '../../services/agentVariantService';
import type { AgentVariantTemplate } from '../../types/agentVariant';
import { Search, Plus, Cpu, Loader2, AlertCircle, Puzzle, MemoryStick, HardDrive, ArrowUpDown } from 'lucide-react';

const VARIANT_CATEGORIES = [
  { id: 'All', labelKey: 'marketplace.categories.all' },
  { id: 'developer', labelKey: 'marketplace.categories.developer' },
  { id: 'creative', labelKey: 'marketplace.categories.creative' },
  { id: 'business', labelKey: 'marketplace.categories.business' },
  { id: 'research', labelKey: 'marketplace.categories.research' },
  { id: 'general', labelKey: 'marketplace.categories.general' },
];

type SortKey = 'popular' | 'name' | 'newest';

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: 'popular', labelKey: 'marketplace.sortMostPopular' },
  { key: 'name', labelKey: 'marketplace.sortNameAZ' },
  { key: 'newest', labelKey: 'marketplace.sortNewest' },
];

const SKILL_COUNT = (v: AgentVariantTemplate) =>
  Array.isArray(v.skill_ids) ? v.skill_ids.length : 0;

const AgentMarketplacePage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [variants, setVariants] = useState<AgentVariantTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('popular');

  const loadVariants = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await agentVariantService.listPublic();
      setVariants(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('marketplace.loadError'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  const displayedVariants = useMemo(() => {
    const filtered = variants.filter((v) => {
      const matchesCategory = category === 'All' || v.category === category;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        v.name.toLowerCase().includes(query) ||
        (v.description || '').toLowerCase().includes(query) ||
        v.runtime_type.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.usage_count || 0) - (a.usage_count || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });
  }, [variants, category, searchQuery, sortBy]);

  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = { All: variants.length };
    variants.forEach((v) => {
      counts[v.category] = (counts[v.category] || 0) + 1;
    });
    return counts;
  }, [variants]);

  return (
    <UserLayout title={t('marketplace.title')}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {VARIANT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                category === cat.id
                  ? 'bg-[#ef4444] text-white shadow-md'
                  : 'bg-white border border-[#eadfd8] text-[#5f5957] hover:bg-[#fff8f5]'
              }`}
            >
              {t(cat.labelKey)}
              <span className="ml-1.5 opacity-50 text-xs">
                {countByCategory[cat.id] || 0}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c938e]"
              size={18}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('marketplace.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 border border-[#eadfd8] rounded-xl bg-white text-sm text-[#171212] placeholder-[#9c938e] focus:outline-none focus:ring-1 focus:ring-[#f3d2c2] focus:border-[#ef4444]"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="appearance-none pl-3 pr-8 py-2.5 border border-[#eadfd8] rounded-xl bg-white text-sm text-[#5f5957] focus:outline-none focus:ring-1 focus:ring-[#f3d2c2] cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{t(opt.labelKey)}</option>
              ))}
            </select>
            <ArrowUpDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9c938e] pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin w-6 h-6 text-[#ef4444]" />
          <span className="ml-3 text-[#5f5957]">{t('common.loading')}</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadVariants()}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            {t('marketplace.retry')}
          </button>
        </div>
      ) : displayedVariants.length === 0 ? (
        <div className="text-center py-20">
          <Cpu className="mx-auto h-12 w-12 text-[#9c938e]" />
          <h3 className="mt-4 text-lg font-semibold text-[#171212]">
            {t('marketplace.noAgents')}
          </h3>
          <p className="mt-1 text-sm text-[#696363]">
            {t('marketplace.noAgentsSubtitle')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayedVariants.map((variant) => (
            <div
              key={variant.id}
              className="app-panel flex flex-col hover:shadow-[0_30px_80px_-52px_rgba(72,44,24,0.62)] transition-shadow cursor-pointer"
              onClick={() => navigate(`/marketplace/${variant.slug}`)}
            >
              <div className="p-6 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-[#fdf9f7] border border-[#eadfd8] rounded-2xl flex items-center justify-center text-[#ef6b4a]">
                    <Cpu size={24} />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-[#fdf9f7] border border-[#eadfd8] rounded-lg text-[#696363] uppercase tracking-widest">
                    {t('marketplace.categories.' + variant.category) || variant.category}
                  </span>
                </div>

                <h3 className="text-lg font-bold mb-1 text-[#171212]">
                  {variant.name}
                </h3>
                <p className="text-sm text-[#696363] mb-4 line-clamp-2 leading-relaxed">
                  {variant.description || t('marketplace.runtimeVariant', { type: variant.runtime_type })}
                </p>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fdf9f7] border border-[#eadfd8] px-2 py-1 text-[10px] text-[#5f5957]">
                    <Cpu size={10} />
                    {variant.recommended_cpu}c
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fdf9f7] border border-[#eadfd8] px-2 py-1 text-[10px] text-[#5f5957]">
                    <MemoryStick size={10} />
                    {variant.recommended_memory}G
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#fdf9f7] border border-[#eadfd8] px-2 py-1 text-[10px] text-[#5f5957]">
                    <HardDrive size={10} />
                    {variant.recommended_disk}G
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] text-[#b46c50] font-mono bg-[#fdf9f7] px-2 py-0.5 rounded">
                    #{variant.runtime_type}
                  </span>
                  {SKILL_COUNT(variant) > 0 && (
                    <span className="text-[10px] text-[#5f5957] font-mono bg-[#fdf9f7] px-2 py-0.5 rounded flex items-center gap-1">
                      <Puzzle size={10} />
                      {t('marketplace.skillCount', { count: SKILL_COUNT(variant) })}
                    </span>
                  )}
                  {variant.usage_count > 0 && (
                    <span className="text-[10px] text-[#5f5957] font-mono bg-[#fdf9f7] px-2 py-0.5 rounded">
                      {t('marketplace.deploymentCount', { count: variant.usage_count })}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-[#f1e7e1] bg-[rgba(255,248,245,0.82)] px-6 py-4">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/marketplace/${variant.slug}/quick-create`); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#eadfd8] bg-white text-sm font-semibold text-[#5f5957] hover:bg-[#fff8f5] hover:border-[#ef6b4a] transition-all"
                >
                  {t('marketplace.quickDeploy')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/marketplace/${variant.slug}`); }}
                  className="px-4 py-2.5 rounded-xl bg-[linear-gradient(135deg,#ef6b4a_0%,#dc2626_100%)] text-white shadow-[0_18px_32px_-24px_rgba(220,38,38,0.6)] hover:translate-y-[-1px] transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </UserLayout>
  );
};

export default AgentMarketplacePage;
