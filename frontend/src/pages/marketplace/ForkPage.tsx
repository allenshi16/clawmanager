import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserLayout from '../../components/UserLayout';
import { useI18n } from '../../contexts/I18nContext';
import { agentVariantService } from '../../services/agentVariantService';
import type { AgentVariantTemplate, CreateVariantTemplateRequest } from '../../types/agentVariant';
import { Cpu, HardDrive, MemoryStick, Loader2, AlertCircle, ArrowLeft, GitFork } from 'lucide-react';

const ForkPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [source, setSource] = useState<AgentVariantTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [forkSlug, setForkSlug] = useState('');
  const [description, setDescription] = useState('');
  const [cpu, setCpu] = useState(2);
  const [memory, setMemory] = useState(4);
  const [disk, setDisk] = useState(20);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    agentVariantService.getBySlug(slug)
      .then((v) => {
        setSource(v);
        setName(v.name + t('marketplace.fork.forkNameSuffix'));
        setForkSlug(`${v.slug}-fork-${Date.now()}`);
        setDescription(v.description || '');
        setCpu(v.recommended_cpu || 2);
        setMemory(v.recommended_memory || 4);
        setDisk(v.recommended_disk || 20);
      })
      .catch((err) => setError(err.response?.data?.error || t('marketplace.fork.loadError')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  const handleFork = async () => {
    if (!source || !name.trim() || !forkSlug.trim()) return;
    setForking(true);
    setError(null);
    try {
      const req: CreateVariantTemplateRequest = {
        name: name.trim(),
        slug: forkSlug.trim(),
        description: description.trim() || undefined,
        runtime_type: source.runtime_type,
        skill_ids: [],
        icon: source.icon,
        category: source.category,
        is_public: false,
        recommended_cpu: cpu,
        recommended_memory: memory,
        recommended_disk: disk,
      };
      await agentVariantService.forkTemplate(source.id, req);
      navigate(`/admin/agent-variants`);
    } catch (err: any) {
      setError(err.response?.data?.error || t('marketplace.fork.forkError'));
    } finally {
      setForking(false);
    }
  };

  if (loading) {
    return (
      <UserLayout title={t('marketplace.fork.title')}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin w-6 h-6 text-[#ef4444]" />
          <span className="ml-3 text-[#5f5957]">{t('marketplace.fork.loading')}</span>
        </div>
      </UserLayout>
    );
  }

  if (error && !source) {
    return (
      <UserLayout title={t('marketplace.fork.title')}>
        <div className="max-w-lg mx-auto mt-12">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="mt-4 app-button-secondary flex items-center gap-2"
          >
            <ArrowLeft size={16} /> {t('marketplace.fork.backMarketplace')}
          </button>
        </div>
      </UserLayout>
    );
  }

  if (!source) return null;

  return (
    <UserLayout title={t('marketplace.fork.title')}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate(`/marketplace/${slug}`)}
          className="inline-flex items-center gap-2 text-sm text-[#8f8681] hover:text-[#171212] transition-colors"
        >
          <ArrowLeft size={16} /> {t('marketplace.fork.backApp')}
        </button>

        <div className="app-panel p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-[#fdf9f7] border border-[#eadfd8] rounded-2xl flex items-center justify-center text-[#ef6b4a] shrink-0">
              <GitFork size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[#171212]">{t('marketplace.fork.forkTitle', { name: source.name })}</h2>
              <p className="mt-1 text-sm text-[#696363]">
                {t('marketplace.fork.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="app-panel p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#171212] mb-2">{t('marketplace.fork.basicInfo')}</h3>

          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('marketplace.fork.nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="app-input w-full"
              placeholder={t('marketplace.fork.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('marketplace.fork.slugLabel')}</label>
            <input
              type="text"
              value={forkSlug}
              onChange={(e) => setForkSlug(e.target.value)}
              className="app-input w-full"
              placeholder={t('marketplace.fork.slugPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('marketplace.fork.descLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="app-input w-full min-h-[80px]"
              placeholder={t('marketplace.fork.descPlaceholder')}
            />
          </div>
        </div>

        <div className="app-panel p-6">
          <h3 className="text-lg font-semibold text-[#171212] mb-4">{t('marketplace.fork.resourceConfig')}</h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#5f5957] mb-1.5">
                <Cpu size={16} /> {t('marketplace.fork.cpuCores')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="16"
                  step="0.5"
                  value={cpu}
                  onChange={(e) => setCpu(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-[#171212] w-12 text-right">{cpu}</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#5f5957] mb-1.5">
                <MemoryStick size={16} /> {t('marketplace.fork.memory')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="64"
                  step="1"
                  value={memory}
                  onChange={(e) => setMemory(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-[#171212] w-12 text-right">{memory}GB</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#5f5957] mb-1.5">
                <HardDrive size={16} /> {t('marketplace.fork.disk')}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={disk}
                  onChange={(e) => setDisk(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-[#171212] w-12 text-right">{disk}GB</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          onClick={handleFork}
          disabled={forking || !name.trim() || !forkSlug.trim()}
          className="w-full py-3 rounded-xl bg-[linear-gradient(135deg,#ef6b4a_0%,#dc2626_100%)] text-white font-semibold shadow-[0_18px_32px_-24px_rgba(220,38,38,0.6)] hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {forking ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              {t('marketplace.fork.forking')}
            </>
          ) : (
            <>
              <GitFork size={18} />
              {t('marketplace.fork.fork', { name: source.name })}
            </>
          )}
        </button>
      </div>
    </UserLayout>
  );
};

export default ForkPage;
