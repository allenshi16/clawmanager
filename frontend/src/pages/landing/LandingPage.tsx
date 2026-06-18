import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { agentVariantService } from '../../services/agentVariantService';
import { instanceService } from '../../services/instanceService';
import AuthModal from '../../components/AuthModal';
import type { AgentVariantTemplate } from '../../types/agentVariant';
import { Sparkles, Cpu, Puzzle, Loader2, Search, Zap, Sun, Moon } from 'lucide-react';

const CATEGORIES = [
  { id: 'All', labelKey: 'landing.categories.all' },
  { id: 'developer', labelKey: 'landing.categories.developer' },
  { id: 'creative', labelKey: 'landing.categories.creative' },
  { id: 'business', labelKey: 'landing.categories.business' },
  { id: 'research', labelKey: 'landing.categories.research' },
  { id: 'general', labelKey: 'landing.categories.general' },
];

const LandingPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [variants, setVariants] = useState<AgentVariantTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState<number | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    agentVariantService
      .listPublic()
      .then(setVariants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredVariants = variants.filter((v) => {
    const matchesCategory = category === 'All' || v.category === category;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      v.name.toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const skillCount = (v: AgentVariantTemplate) =>
    Array.isArray(v.skill_ids) ? v.skill_ids.length : 0;

  const countByCategory: Record<string, number> = { All: variants.length };
  variants.forEach((v) => {
    countByCategory[v.category] = (countByCategory[v.category] || 0) + 1;
  });

  const handleTrial = (variant: AgentVariantTemplate) => {
    setTrialError(null);
    if (isAuthenticated) {
      createTrialInstance(variant);
    } else {
      setPendingVariantId(variant.id);
      setAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = useCallback(() => {
    setAuthModalOpen(false);
    const vid = pendingVariantId;
    setPendingVariantId(null);
    if (vid == null) return;
    const variant = variants.find((v) => v.id === vid);
    if (variant) createTrialInstance(variant);
  }, [pendingVariantId, variants]);

  const createTrialInstance = async (variant: AgentVariantTemplate) => {
    setCreatingId(variant.id);
    setTrialError(null);
    try {
      const instance = await instanceService.createInstance({
        type: variant.runtime_type as any,
        variant_id: variant.id,
        name: t('landing.trialInstanceName', { name: variant.name }),
        cpu_cores: 1,
        memory_gb: 2,
        disk_gb: 20,
        os_type: 'ubuntu',
        os_version: '22.04',
      });
      navigate(`/instances/${instance.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || t('landing.createFailed');
      setTrialError(msg);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="w-full bg-amber-50/50 dark:bg-slate-950 min-h-screen relative font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.06),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.12),transparent_50%)] pointer-events-none" />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingVariantId(null);
        }}
        onSuccess={handleAuthSuccess}
        variantName={
          pendingVariantId != null
            ? variants.find((v) => v.id === pendingVariantId)?.name
            : undefined
        }
      />

      {/* Hero */}
      <header className="max-w-7xl mx-auto px-6 py-10 relative z-20">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-600/20">
              Ω
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
              OpenClaw <span className="text-indigo-400">+ Hermes</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
              aria-label={t('landing.toggleTheme')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {isAuthenticated && (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-bold transition-all cursor-pointer"
              >
                {t('landing.enterConsole')}
              </button>
            )}
          </div>
        </div>

        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 rounded-full text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-6">
            <Sparkles size={12} />
            {t('landing.heroBadge')}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.15] text-slate-900 dark:text-transparent dark:bg-gradient-to-br dark:from-white dark:to-slate-400 dark:bg-clip-text">
            {t('landing.heroTitle').split('\n').map((line, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
            ))}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
            {t('landing.heroSubtitle')}
          </p>
        </div>
      </header>

      {/* Variant Cards */}
      <section className="max-w-7xl mx-auto px-6 pb-32 relative z-20">
        {/* Filters */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  category === cat.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t(cat.labelKey)}
                <span className="ml-1.5 opacity-50 text-xs">{countByCategory[cat.id] || 0}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('landing.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {trialError && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-red-600 dark:text-red-300 text-sm flex items-center justify-between">
            <span>{trialError}</span>
            <button onClick={() => setTrialError(null)} className="text-red-400 hover:text-red-300 ml-4">
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin w-6 h-6 text-indigo-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">{t('landing.loading')}</span>
          </div>
        ) : filteredVariants.length === 0 ? (
          <div className="text-center py-20">
            <Cpu className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-4 text-lg font-semibold text-slate-700 dark:text-white">{t('landing.noAgents')}</h3>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t('landing.noAgentsSubtitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredVariants.map((variant) => (
              <div
                key={variant.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-[0_0_40px_-12px_rgba(79,70,229,0.08)] dark:hover:shadow-[0_0_40px_-12px_rgba(79,70,229,0.15)] transition-all duration-300"
              >
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                      <Zap size={22} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {t('landing.categories.' + variant.category) || variant.category}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{variant.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 leading-relaxed">
                    {variant.description || t('landing.runtimeVariant', { type: variant.runtime_type })}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
                      #{variant.runtime_type}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <Puzzle size={10} />
                      {t('landing.skillCount', { count: skillCount(variant) })}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4">
                  <button
                    onClick={() => handleTrial(variant)}
                    disabled={creatingId === variant.id}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-[0_8px_24px_-8px_rgba(79,70,229,0.4)] hover:translate-y-[-1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creatingId === variant.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {t('landing.freeTrial')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="py-12 border-t border-slate-200 dark:border-slate-900 px-6 text-center text-slate-400 dark:text-slate-600 text-[10px] uppercase font-bold tracking-[0.2em] relative z-20">
        {t('landing.footer')}
      </footer>
    </div>
  );
};

export default LandingPage;
