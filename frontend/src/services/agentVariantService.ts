import api from './api';
import type {
  AgentVariantTemplate,
  AgentVariantTemplateVersion,
  CreateVariantTemplateRequest,
  UpdateVariantTemplateRequest,
  TemplateStats,
  VersionDiff,
} from '../types/agentVariant';

export const agentVariantService = {
  listPublic: async (): Promise<AgentVariantTemplate[]> => {
    const response = await api.get('/agent-variants');
    return response.data.data.variants;
  },

  getBySlug: async (slug: string): Promise<AgentVariantTemplate> => {
    const response = await api.get(`/agent-variants/${slug}`);
    return response.data.data;
  },

  listAll: async (): Promise<AgentVariantTemplate[]> => {
    const response = await api.get('/admin/agent-variants');
    return response.data.data.variants;
  },

  getById: async (id: number): Promise<AgentVariantTemplate> => {
    const response = await api.get(`/admin/agent-variants/${id}`);
    return response.data.data;
  },

  create: async (req: CreateVariantTemplateRequest): Promise<AgentVariantTemplate> => {
    const response = await api.post('/admin/agent-variants', req);
    return response.data.data;
  },

  update: async (id: number, req: UpdateVariantTemplateRequest): Promise<AgentVariantTemplate> => {
    const response = await api.put(`/admin/agent-variants/${id}`, req);
    return response.data.data;
  },

  publish: async (id: number): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/publish`);
  },

  deprecate: async (id: number): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/deprecate`);
  },

  archive: async (id: number): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/archive`);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin/agent-variants/${id}`);
  },

  listVersions: async (id: number): Promise<AgentVariantTemplateVersion[]> => {
    const response = await api.get(`/admin/agent-variants/${id}/versions`);
    return response.data.data.versions;
  },

  getVersion: async (id: number, version: number): Promise<AgentVariantTemplateVersion> => {
    const response = await api.get(`/admin/agent-variants/${id}/versions/${version}`);
    return response.data.data;
  },

  getStats: async (): Promise<TemplateStats> => {
    const response = await api.get('/admin/agent-variants/stats');
    return response.data.data;
  },

  forkTemplate: async (id: number, req: CreateVariantTemplateRequest): Promise<AgentVariantTemplate> => {
    const response = await api.post(`/admin/agent-variants/${id}/fork`, req);
    return response.data.data;
  },

  diffVersions: async (id: number, v1: number, v2: number): Promise<VersionDiff> => {
    const response = await api.get(`/admin/agent-variants/${id}/diff`, { params: { v1, v2 } });
    return response.data.data;
  },

  restoreVersion: async (id: number, version: number): Promise<AgentVariantTemplate> => {
    const response = await api.post(`/admin/agent-variants/${id}/rollback`, { version });
    return response.data.data;
  },

  submitForReview: async (id: number): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/submit-review`);
  },

  approve: async (id: number, comment?: string): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/approve`, { comment });
  },

  reject: async (id: number, comment?: string): Promise<void> => {
    await api.put(`/admin/agent-variants/${id}/reject`, { comment });
  },

  listByReviewStatus: async (status: string): Promise<AgentVariantTemplate[]> => {
    const response = await api.get('/admin/agent-variants/review', { params: { status } });
    return response.data.data.variants;
  },

  bulkPublish: async (ids: number[]): Promise<void> => {
    await api.post('/admin/agent-variants/batch/publish', { ids });
  },

  bulkDeprecate: async (ids: number[]): Promise<void> => {
    await api.post('/admin/agent-variants/batch/deprecate', { ids });
  },

  bulkArchive: async (ids: number[]): Promise<void> => {
    await api.post('/admin/agent-variants/batch/archive', { ids });
  },
};
