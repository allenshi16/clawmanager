import React, { useEffect, useState } from 'react';
import UserLayout from '../../components/UserLayout';
import { channelService } from '../../services/channelService';
import type { Channel } from '../../types/channel';

const ChannelsPage: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [channelType, setChannelType] = useState<'telegram' | 'feishu'>('telegram');
  const [channelName, setChannelName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const data = await channelService.getChannels();
      setChannels(data);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await channelService.createChannel({
        type: channelType,
        name: channelName,
        bot_token: botToken || undefined,
        app_id: appId || undefined,
        app_secret: appSecret || undefined,
      });
      setShowCreateModal(false);
      resetForm();
      loadChannels();
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  const resetForm = () => {
    setChannelName('');
    setBotToken('');
    setAppId('');
    setAppSecret('');
  };

  return (
    <UserLayout title="渠道管理">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            渠道管理
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c] transition-colors"
          >
            + 创建渠道
          </button>
        </div>

        {/* Channel List */}
              {loading ? (
          <div className="text-center py-8 text-gray-500">
            加载中...
          </div>
        ) : channels.length === 0 ? (
          <div className="app-panel p-8 text-center">
            <p className="text-gray-500">
              暂无渠道，请创建第一个渠道
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {channels.map((channel) => (
              <div key={channel.id} className="app-panel p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{channel.name}</h3>
                    <p className="text-sm text-gray-500">
                      {channel.type === 'telegram' ? 'Telegram' : '飞书'} • ID: {channel.id}
                    </p>
                    {channel.webhook_url && (
                      <p className="text-xs text-gray-400 mt-1">
                        Webhook: {channel.webhook_url}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    channel.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {channel.is_active ? '已激活' : '未激活'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold">
              创建渠道
            </h3>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  类型
                </label>
                <select
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value as 'telegram' | 'feishu')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
                >
                  <option value="telegram">Telegram</option>
                  <option value="feishu">飞书 (Feishu)</option>
                </select>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
                      placeholder="输入渠道名称"
                />
              </div>

              {channelType === 'telegram' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bot Token
                  </label>
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
                    placeholder="123456:ABC-DEF..."
                  />
                </div>
              )}

              {channelType === 'feishu' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App ID
                    </label>
                    <input
                      type="text"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
                      placeholder="cli_xxx"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      App Secret
                    </label>
                    <input
                      type="password"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#dc2626]"
                      placeholder="..."
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4">
                  <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c]"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default ChannelsPage;
