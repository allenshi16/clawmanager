import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import { agentVariantService } from '../../services/agentVariantService';
import type { AgentVariantTemplate, CreateVariantTemplateRequest } from '../../types/agentVariant';
import { Plus, Pencil, Trash2, Loader2, EyeOff, CheckCircle, XCircle, Clock, Archive as ArchiveIcon, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';


const CATEGORIES = [
  { value: 'general', labelKey: 'agentVariant.categories.general' },
  { value: 'developer', labelKey: 'agentVariant.categories.developer' },
  { value: 'creative', labelKey: 'agentVariant.categories.creative' },
  { value: 'business', labelKey: 'agentVariant.categories.business' },
  { value: 'research', labelKey: 'agentVariant.categories.research' },
];

const StatusBadge: React.FC<{ status: string; t: (key: string) => string }> = ({ status, t }) => {
  const styles: Record<string, string> = {
    published: 'bg-green-50 text-green-700',
    draft: 'bg-gray-100 text-gray-500',
    deprecated: 'bg-yellow-50 text-yellow-700',
    archived: 'bg-red-50 text-red-500',
  };
  const icons: Record<string, React.ReactNode> = {
    published: <CheckCircle size={12} />,
    draft: <EyeOff size={12} />,
    deprecated: <Clock size={12} />,
    archived: <ArchiveIcon size={12} />,
  };
  const labelKey = status === 'published' ? 'agentVariant.status.published' : 
                    status === 'draft' ? 'agentVariant.status.draft' :
                    status === 'deprecated' ? 'agentVariant.status.deprecated' :
                    status === 'archived' ? 'agentVariant.status.archived' : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {icons[status] || null}
      {labelKey ? t(labelKey) : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const ReviewBadge: React.FC<{ reviewStatus: string; t: (key: string) => string }> = ({ reviewStatus, t }) => {
  const styles: Record<string, string> = {
    approved: 'bg-green-50 text-green-700',
    pending: 'bg-blue-50 text-blue-600',
    rejected: 'bg-red-50 text-red-600',
  };
  const icons: Record<string, React.ReactNode> = {
    approved: <CheckCircle size={12} />,
    pending: <Clock size={12} />,
    rejected: <XCircle size={12} />,
  };
  const labelKey = reviewStatus === 'approved' ? 'agentVariant.reviewStatus.approved' :
                    reviewStatus === 'pending' ? 'agentVariant.reviewStatus.pending' :
                    reviewStatus === 'rejected' ? 'agentVariant.reviewStatus.rejected' : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[reviewStatus] || 'bg-gray-100 text-gray-500'}`}>
      {icons[reviewStatus] || null}
      {labelKey ? t(labelKey) : reviewStatus.charAt(0).toUpperCase() + reviewStatus.slice(1)}
    </span>
  );
};

const ICON_VALUES = ['bot', 'code', 'terminal', 'file-text', 'brain', 'cpu', 'zap', 'star'];

const getIconLabel = (value: string, t: (key: string) => string): string => {
  const keyMap: Record<string, string> = {
    'bot': 'agentVariant.icons.bot',
    'code': 'agentVariant.icons.code',
    'terminal': 'agentVariant.icons.terminal',
    'file-text': 'agentVariant.icons.file_text',
    'brain': 'agentVariant.icons.brain',
    'cpu': 'agentVariant.icons.cpu',
    'zap': 'agentVariant.icons.zap',
    'star': 'agentVariant.icons.star',
  };
  return t(keyMap[value] || 'agentVariant.icons.bot');
};

interface FormData {
  name: string;
  slug: string;
  description: string;
  runtime_type: string;
  image_registry: string;
  image_tag: string;
  skill_ids: string;
  config_plan_mode: string;
  config_plan_bundle_id: string;
  icon: string;
  category: string;
  is_public: boolean;
  recommended_cpu: string;
  recommended_memory: string;
  recommended_disk: string;
  readme_md: string;
}

const emptyForm = (): FormData => ({
  name: '',
  slug: '',
  description: '',
  runtime_type: 'openclaw',
  image_registry: '',
  image_tag: '',
  skill_ids: '',
  config_plan_mode: '',
  config_plan_bundle_id: '',
  icon: 'bot',
  category: 'general',
  is_public: true,
  recommended_cpu: '2',
  recommended_memory: '4',
  recommended_disk: '20',
  readme_md: '',
});

const AgentVariantManagementPage: React.FC = () => {
  const { t } = useI18n();
  const [variants, setVariants] = useState<AgentVariantTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewModal, setReviewModal] = useState<{ id: number; action: 'approve' | 'reject' } | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [pendingDelete, setPendingDelete] = useState<AgentVariantTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVariants = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await agentVariantService.listAll();
      setVariants(data);
    } catch (err: any) {
      setError(err.response?.data?.error || t('agentVariant.loadFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (variant: AgentVariantTemplate) => {
    setEditingId(variant.id);
    const cp = variant.config_plan || {};
    setForm({
      name: variant.name,
      slug: variant.slug,
      description: variant.description || '',
      runtime_type: variant.runtime_type,
      image_registry: variant.image_registry || '',
      image_tag: variant.image_tag || '',
      skill_ids: (variant.skill_ids || []).join(', '),
      config_plan_mode: (cp as any).mode || '',
      config_plan_bundle_id: (cp as any).bundle_id ? String((cp as any).bundle_id) : '',
      icon: variant.icon || 'bot',
      category: variant.category,
      is_public: variant.is_public,
      recommended_cpu: String(variant.recommended_cpu ?? 2),
      recommended_memory: String(variant.recommended_memory ?? 4),
      recommended_disk: String(variant.recommended_disk ?? 20),
      readme_md: variant.readme_md || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const buildRequest = (): CreateVariantTemplateRequest => {
    const skillIds = form.skill_ids
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    let configPlan: Record<string, unknown> | undefined;
    if (form.config_plan_mode) {
      configPlan = { mode: form.config_plan_mode };
      const bid = parseInt(form.config_plan_bundle_id, 10);
      if (!isNaN(bid)) {
        (configPlan as any).bundle_id = bid;
      }
    }

    const cpu = parseFloat(form.recommended_cpu);
    const mem = parseInt(form.recommended_memory, 10);
    const disk = parseInt(form.recommended_disk, 10);

    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      runtime_type: form.runtime_type,
      image_registry: form.image_registry.trim() || undefined,
      image_tag: form.image_tag.trim() || undefined,
      skill_ids: skillIds,
      config_plan: configPlan,
      icon: form.icon,
      category: form.category,
      is_public: form.is_public,
      recommended_cpu: isNaN(cpu) ? 2 : cpu,
      recommended_memory: isNaN(mem) ? 4 : mem,
      recommended_disk: isNaN(disk) ? 20 : disk,
      readme_md: form.readme_md || undefined,
    };
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.runtime_type) {
      setFormError(t('agentVariant.form.required'));
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const req = buildRequest();
      if (editingId) {
        await agentVariantService.update(editingId, req);
      } else {
        await agentVariantService.create(req);
      }
      setModalOpen(false);
      await loadVariants(true);
    } catch (err: any) {
      setFormError(err.response?.data?.error || t('agentVariant.form.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async (id: number, action: 'publish' | 'deprecate' | 'archive') => {
    try {
      if (action === 'publish') await agentVariantService.publish(id);
      else if (action === 'deprecate') await agentVariantService.deprecate(id);
      else if (action === 'archive') await agentVariantService.archive(id);
      await loadVariants(true);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action} variant`);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await agentVariantService.delete(pendingDelete.id);
      setPendingDelete(null);
      await loadVariants(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete variant');
    } finally {
      setDeleting(false);
    }
  };

  // Batch operations
  const toggleSelectAll = () => {
    if (selectedIds.size === variants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(variants.map((v) => v.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatch = async (action: 'publish' | 'deprecate' | 'archive') => {
    if (selectedIds.size === 0) return;
    const actionKey = action === 'publish' ? 'actions.publish' : action === 'deprecate' ? 'actions.deprecate' : 'actions.archive';
    if (!window.confirm(t('agentVariant.batch.confirm', { action: t(`agentVariant.${actionKey}`), count: selectedIds.size }))) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      if (action === 'publish') await agentVariantService.bulkPublish(ids);
      else if (action === 'deprecate') await agentVariantService.bulkDeprecate(ids);
      else if (action === 'archive') await agentVariantService.bulkArchive(ids);
      setSelectedIds(new Set());
      await loadVariants(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('agentVariant.batch.failed', { action: t(`agentVariant.${actionKey}`) }));
    } finally {
      setBatchLoading(false);
    }
  };

  // Review workflow
  const handleSubmitForReview = async (id: number) => {
    try {
      await agentVariantService.submitForReview(id);
      await loadVariants(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('agentVariant.actions.failedAction', { action: t('agentVariant.actions.submit') }));
    }
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    try {
      if (reviewModal.action === 'approve') {
        await agentVariantService.approve(reviewModal.id, reviewComment);
      } else {
        await agentVariantService.reject(reviewModal.id, reviewComment);
      }
      setReviewModal(null);
      setReviewComment('');
      await loadVariants(true);
    } catch (err: any) {
      const actionKey = reviewModal.action === 'approve' ? 'actions.approve' : 'actions.reject';
      setError(err.response?.data?.error || t('agentVariant.actions.failedAction', { action: t(`agentVariant.${actionKey}`) }));
    }
  };

  const renderModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#f1e7e1] px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#171212]">
            {editingId ? t('agentVariant.modal.edit') : t('agentVariant.modal.create')}
          </h3>
          <button onClick={() => setModalOpen(false)} className="text-[#9c938e] hover:text-[#171212]">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{formError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('agentVariant.form.name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="app-input w-full"
              placeholder={t('agentVariant.form.namePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('agentVariant.form.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="app-input w-full"
              rows={3}
              placeholder={t('agentVariant.form.descriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('agentVariant.form.runtimeType')}</label>
              <select
                value={form.runtime_type}
                onChange={(e) => setForm({ ...form, runtime_type: e.target.value })}
                className="app-input w-full"
              >
                <option value="openclaw">OpenClaw</option>
                <option value="ubuntu">Ubuntu (Webtop)</option>
                <option value="webtop">Webtop</option>
                <option value="hermes">Hermes</option>
                <option value="hermes-agent">Hermes Agent</option>
                <option value="debian">Debian</option>
                <option value="centos">CentOS</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('agentVariant.form.category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="app-input w-full"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>
          <fieldset className="border border-[#f1e7e1] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[#5f5957] px-2">{t('agentVariant.form.imageOverride')}</legend>
            <p className="text-xs text-[#8f8681] mb-3">{t('agentVariant.form.imageOverrideHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#8f8681] mb-1">{t('agentVariant.form.imageRegistry')}</label>
                <input
                  type="text"
                  value={form.image_registry}
                  onChange={(e) => setForm({ ...form, image_registry: e.target.value })}
                  className="app-input w-full"
                  placeholder="e.g. ghcr.io/org/image"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8f8681] mb-1">{t('agentVariant.form.imageTag')}</label>
                <input
                  type="text"
                  value={form.image_tag}
                  onChange={(e) => setForm({ ...form, image_tag: e.target.value })}
                  className="app-input w-full"
                  placeholder="e.g. latest, v1.0"
                />
              </div>
            </div>
          </fieldset>
          <div>
            <label className="block text-sm font-medium text-[#5f5957] mb-1">{t('agentVariant.form.icon')}</label>
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="app-input w-full"
            >
              {ICON_VALUES.map((ic) => (
                <option key={ic} value={ic}>{getIconLabel(ic, t)}</option>
              ))}
            </select>
          </div>
          <fieldset className="border border-[#f1e7e1] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[#5f5957] px-2">{t('agentVariant.form.resources')}</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#8f8681] mb-1">{t('agentVariant.form.cpu')}</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="32"
                  value={form.recommended_cpu}
                  onChange={(e) => setForm({ ...form, recommended_cpu: e.target.value })}
                  className="app-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8f8681] mb-1">{t('agentVariant.form.memory')}</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="128"
                  value={form.recommended_memory}
                  onChange={(e) => setForm({ ...form, recommended_memory: e.target.value })}
                  className="app-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8f8681] mb-1">{t('agentVariant.form.disk')}</label>
                <input
                  type="number"
                  step="10"
                  min="10"
                  max="1000"
                  value={form.recommended_disk}
                  onChange={(e) => setForm({ ...form, recommended_disk: e.target.value })}
                  className="app-input w-full"
                />
              </div>
            </div>
          </fieldset>
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-[#5f5957]">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
              />
              {t('agentVariant.form.public')}
            </label>
          </div>
        </div>

        <div className="border-t border-[#f1e7e1] px-6 py-4 flex justify-end gap-3">
          <button
            onClick={() => setModalOpen(false)}
            className="app-button-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="app-button-primary flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            {editingId ? t('agentVariant.modal.update') : t('agentVariant.modal.create')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout title={t('agentVariant.title')}>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('agentVariant.deleteVariant')}
        message={t('agentVariant.deleteConfirm', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />

      {modalOpen && renderModal()}

      <div className="space-y-6">
        <div className="app-panel p-5 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#171212]">{t('agentVariant.title')}</h2>
            <p className="mt-1 text-sm text-[#8f8681]">
              {t('agentVariant.subtitle')}
            </p>
          </div>
          <button onClick={openCreate} className="app-button-primary flex items-center gap-2 mt-4 lg:mt-0">
            <Plus size={16} />
            {t('agentVariant.createTemplate')}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}

        {/* Batch Action Bar */}
        {selectedIds.size > 0 && (
          <div className="app-panel px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-[#5f5957]">{t('agentVariant.batch.selected', { count: selectedIds.size })}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBatch('publish')}
                disabled={batchLoading}
                className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle size={12} /> {t('agentVariant.batch.publish', { count: selectedIds.size })}
              </button>
              <button
                onClick={() => handleBatch('deprecate')}
                disabled={batchLoading}
                className="rounded-md bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50 flex items-center gap-1"
              >
                <Clock size={12} /> {t('agentVariant.batch.deprecate', { count: selectedIds.size })}
              </button>
              <button
                onClick={() => handleBatch('archive')}
                disabled={batchLoading}
                className="rounded-md bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
              >
                <ArchiveIcon size={12} /> {t('agentVariant.batch.archive', { count: selectedIds.size })}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[#8f8681] hover:text-[#171212]"
              >
                {t('agentVariant.batch.clear')}
              </button>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/30" onClick={() => setReviewModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
              <h3 className="text-lg font-semibold text-[#171212] mb-4">
                {reviewModal.action === 'approve' ? t('agentVariant.review.approveTitle') : t('agentVariant.review.rejectTitle')}
              </h3>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="app-input w-full"
                rows={3}
                placeholder={t('agentVariant.review.commentPlaceholder', { count: selectedIds.size })}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setReviewModal(null)} className="app-button-secondary">{t('agentVariant.review.cancel')}</button>
                <button
                  onClick={handleReview}
                  className={`app-button-primary ${reviewModal.action === 'reject' ? '!bg-red-500 !hover:bg-red-600' : ''}`}
                >
                  {reviewModal.action === 'approve' ? t('agentVariant.review.approve') : t('agentVariant.review.reject')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="app-panel overflow-x-auto">
          {loading ? (
            <div className="px-5 py-12 text-center text-[#8f8681]">
              <Loader2 className="animate-spin mx-auto mb-3" size={24} />
              {t('agentVariant.loading')}
            </div>
          ) : variants.length === 0 ? (
            <div className="px-5 py-12 text-center text-[#8f8681]">
              {t('agentVariant.empty')}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[#f1e7e1]">
              <thead className="bg-[#fcfaf8]">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === variants.length && variants.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.name')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.runtime')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.skills')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.category')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.status')}</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.review')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.uses')}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8681]">{t('agentVariant.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7efe9]">
                {variants.map((v) => (
                  <tr key={v.id} className="hover:bg-[#fffaf7]">
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[#171212]">{v.name}</div>
                      <div className="mt-1 text-xs text-[#8f8681]">{v.slug}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#fff2ea] text-[#ef6b4a]">
                        {v.runtime_type}
                      </span>
                      {v.image_registry && (
                        <div className="mt-1 text-xs text-[#8f8681] font-mono truncate max-w-[200px]" title={`${v.image_registry}${v.image_tag ? ':' + v.image_tag : ''}`}>
                          {v.image_registry}{v.image_tag ? `:${v.image_tag}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#5f5957]">
                      {(v.skill_ids || []).length || '-'}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#5f5957] capitalize">
                      {v.category}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={v.status} t={t} />
                    </td>
                    <td className="px-5 py-4">
                      <ReviewBadge reviewStatus={v.review_status} t={t} />
                    </td>
                    <td className="px-5 py-4 text-sm text-[#5f5957] text-right">
                      {v.usage_count || 0}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {v.review_status === 'pending' && (
                          <>
                            <button
                              onClick={() => setReviewModal({ id: v.id, action: 'approve' })}
                              className="rounded-md bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 flex items-center gap-1"
                            >
                              <ThumbsUp size={12} />
                              {t('agentVariant.actions.approve')}
                            </button>
                            <button
                              onClick={() => setReviewModal({ id: v.id, action: 'reject' })}
                              className="rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 flex items-center gap-1"
                            >
                              <ThumbsDown size={12} />
                              {t('agentVariant.actions.reject')}
                            </button>
                          </>
                        )}
                        {v.status === 'draft' && v.review_status !== 'pending' && (
                          <button
                            onClick={() => handleSubmitForReview(v.id)}
                            className="rounded-md bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 flex items-center gap-1"
                          >
                            <Send size={12} />
                            {t('agentVariant.actions.submit')}
                          </button>
                        )}
                        {v.status !== 'draft' && v.review_status === 'approved' && (
                          <button
                            onClick={() => handleStatusAction(v.id, v.status === 'published' ? 'deprecate' : 'publish')}
                            className="rounded-md bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 flex items-center gap-1"
                          >
                            <CheckCircle size={12} />
                            {v.status === 'published' ? t('agentVariant.actions.deprecate') : t('agentVariant.actions.publish')}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(v)}
                          className="rounded-md bg-[#f3f0ed] px-3 py-1.5 text-xs font-medium text-[#5f5957] hover:bg-[#ebe3dd]"
                          title={t('agentVariant.actions.edit')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setPendingDelete(v)}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          title={t('agentVariant.actions.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AgentVariantManagementPage;
