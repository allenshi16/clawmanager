import type { Channel, CreateChannelRequest } from '../types/channel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

export const channelService = {
  async getChannels(): Promise<Channel[]> {
    const response = await fetch(`${API_URL}/channels`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch channels');
    return response.json();
  },

  async createChannel(data: CreateChannelRequest): Promise<Channel> {
    const response = await fetch(`${API_URL}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create channel');
    return response.json();
  },

  async getChannel(id: number): Promise<Channel> {
    const response = await fetch(`${API_URL}/channels/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch channel');
    return response.json();
  },

  async updateChannel(id: number, data: Partial<CreateChannelRequest>): Promise<Channel> {
    const response = await fetch(`${API_URL}/channels/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update channel');
    return response.json();
  },

  async deleteChannel(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/channels/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete channel');
  },
};
