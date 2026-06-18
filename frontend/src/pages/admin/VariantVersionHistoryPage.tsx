import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentVariantService } from '../../services/agentVariantService';
import type { AgentVariantTemplate, AgentVariantTemplateVersion, VersionDiff } from '../../types/agentVariant';
import { Clock, Hash, Loader2, ArrowLeft, Eye, History, GitCompare, RotateCcw, X, CheckCircle } from 'lucide-react';

const VariantVersionHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<AgentVariantTemplate | null>(null);
  const [versions, setVersions] = useState<AgentVariantTemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedV1, setSelectedV1] = useState<number | null>(null);
  const [selectedV2, setSelectedV2] = useState<number | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id);
    setLoading(true);
    Promise.all([
      agentVariantService.getById(numId),
      agentVariantService.listVersions(numId),
    ])
      .then(([t, v]) => {
        setTemplate(t);
        setVersions(v);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load version history'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDiff = async () => {
    if (!id || selectedV1 == null || selectedV2 == null) return;
    const a = Math.min(selectedV1, selectedV2);
    const b = Math.max(selectedV1, selectedV2);
    setDiffLoading(true);
    setDiffResult(null);
    try {
      const result = await agentVariantService.diffVersions(parseInt(id), a, b);
      setDiffResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to compute diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (!id) return;
    if (!window.confirm(`Restore version ${version}? This will create a new version with the snapshot from v${version}.`)) return;
    setRollbackLoading(true);
    setRollbackMsg(null);
    try {
      await agentVariantService.restoreVersion(parseInt(id), version);
      setRollbackMsg(`Version ${version} restored successfully. Refreshing...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to restore version');
    } finally {
      setRollbackLoading(false);
    }
  };

  const clearDiff = () => {
    setDiffResult(null);
    setSelectedV1(null);
    setSelectedV2(null);
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '(empty)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin w-6 h-6 text-[#ef4444]" />
          <span className="ml-3 text-[#5f5957]">Loading version history...</span>
        </div>
      </div>
    );
  }

  if (error && !diffResult) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto mt-12">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <span>{error}</span>
          </div>
          <button onClick={() => navigate('/admin/agent-variants')} className="mt-4 flex items-center gap-2 text-sm text-[#8f8681] hover:text-[#171212]">
            <ArrowLeft size={16} /> Back to Agent Variants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/admin/agent-variants')}
        className="inline-flex items-center gap-2 text-sm text-[#8f8681] hover:text-[#171212] transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Agent Variants
      </button>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 bg-[#fdf9f7] border border-[#eadfd8] rounded-2xl flex items-center justify-center text-[#ef6b4a] shrink-0">
          <History size={24} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#171212]">Version History</h1>
          <p className="text-sm text-[#696363] mt-1">
            {template?.name} &middot; v{template?.version} current
          </p>
        </div>
      </div>

      {rollbackMsg && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle size={18} /> {rollbackMsg}
        </div>
      )}

      {/* Diff Tool */}
      {versions.length >= 2 && (
        <div className="mb-8 border border-[#eadfd8] rounded-xl bg-white p-5">
          <h3 className="text-sm font-semibold text-[#171212] flex items-center gap-2 mb-4">
            <GitCompare size={16} /> Compare Versions
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-[#8f8681] mb-1">Version A (older)</label>
              <select
                value={selectedV1 ?? ''}
                onChange={(e) => setSelectedV1(e.target.value ? parseInt(e.target.value) : null)}
                className="border border-[#eadfd8] rounded-lg px-3 py-2 text-sm bg-white text-[#171212]"
              >
                <option value="">-- Select --</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>v{v.version}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8f8681] mb-1">Version B (newer)</label>
              <select
                value={selectedV2 ?? ''}
                onChange={(e) => setSelectedV2(e.target.value ? parseInt(e.target.value) : null)}
                className="border border-[#eadfd8] rounded-lg px-3 py-2 text-sm bg-white text-[#171212]"
              >
                <option value="">-- Select --</option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>v{v.version}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleDiff}
              disabled={selectedV1 == null || selectedV2 == null || diffLoading}
              className="px-4 py-2 bg-[#ef6b4a] text-white rounded-lg text-sm font-medium hover:bg-[#dc2626] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {diffLoading ? <Loader2 className="animate-spin" size={14} /> : <GitCompare size={14} />}
              Compare
            </button>
            {diffResult && (
              <button onClick={clearDiff} className="px-3 py-2 border border-[#eadfd8] text-[#696363] rounded-lg text-sm hover:bg-[#fdf9f7]">
                <X size={14} />
              </button>
            )}
          </div>

          {diffResult && (
            <div className="mt-4 border-t border-[#f0eae4] pt-4">
              <p className="text-xs text-[#8f8681] mb-2">
                {diffResult.change_count} change{diffResult.change_count !== 1 ? 's' : ''} between v{diffResult.version_a} and v{diffResult.version_b}
              </p>
              {diffResult.changes.length === 0 ? (
                <p className="text-sm text-green-600">No differences found between these versions.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {diffResult.changes.map((change, i) => (
                    <div key={i} className="border border-[#f0eae4] rounded-lg p-3 bg-[#fdf9f7]">
                      <div className="text-xs font-semibold text-[#696363] mb-1 uppercase tracking-wider">{change.field}</div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-red-50 border border-red-100 rounded p-2 text-red-700 break-all">
                          <span className="font-medium">v{diffResult.version_a}:</span> {formatValue(change.from)}
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded p-2 text-green-700 break-all">
                          <span className="font-medium">v{diffResult.version_b}:</span> {formatValue(change.to)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Version List */}
      {versions.length === 0 ? (
        <div className="text-center py-16">
          <History size={40} className="mx-auto text-[#d4cfcb] mb-3" />
          <p className="text-[#8f8681]">No version history available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="border border-[#eadfd8] rounded-xl bg-white p-4 flex items-center justify-between hover:border-[#d4cfcb] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#fdf9f7] border border-[#eadfd8] rounded-xl flex items-center justify-center text-[#867c78] shrink-0">
                  <Hash size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#171212]">Version {v.version}</span>
                    {template && v.version === template.version && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Current</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-[#8f8681]">
                    <Clock size={12} />
                    <span>{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {template && v.version !== template.version && (
                  <button
                    onClick={() => handleRollback(v.version)}
                    disabled={rollbackLoading}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#696363] hover:text-[#ef6b4a] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#fdf9f7] disabled:opacity-50"
                    title="Restore this version"
                  >
                    {rollbackLoading ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                    Restore
                  </button>
                )}
                <button
                  onClick={() => {}}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#696363] hover:text-[#ef6b4a] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#fdf9f7]"
                  title="View snapshot"
                >
                  <Eye size={14} />
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VariantVersionHistoryPage;
