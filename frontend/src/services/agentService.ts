import api from './api';
import type { AgentTemplate } from '../types/agent';

export const agentService = {
  listTemplates: async (): Promise<AgentTemplate[]> => {
    const response = await api.get('/agents');
    return response.data.data.agents;
  },
};
