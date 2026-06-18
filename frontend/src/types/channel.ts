export type ChannelType = 'telegram' | 'feishu' | 'dingtalk';

export interface Channel {
  id: number;
  user_id: number;
  instance_id?: number;
  type: ChannelType;
  name: string;
  description?: string;
  webhook_url: string;
  bot_token?: string;
  app_id?: string;
  app_secret?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateChannelRequest {
  user_id?: number;
  instance_id?: number;
  type: ChannelType;
  name: string;
  description?: string;
  bot_token?: string;
  app_id?: string;
  app_secret?: string;
}
