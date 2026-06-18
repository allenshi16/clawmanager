import React, { useEffect, useState } from 'react';
import UserLayout from '../../components/UserLayout';
import { billingService } from '../../services/billingService';
import type { SubscriptionPlan, UserSubscription } from '../../types/billing';

const BillingPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansData, subData] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription().catch(() => null),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: number) => {
    try {
      await billingService.createSubscription(planId);
      loadData();
    } catch (err) {
      console.error('Failed to create subscription:', err);
    }
  };

  return (
    <UserLayout title='计费管理'>
      <div className="space-y-8">
        {/* Current Subscription */}
        <div className="app-panel p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            当前订阅
          </h2>
            {loading ? (
            <div className="text-center py-4">加载中...</div>
          ) : subscription ? (
            <div>
              <p className="text-lg font-medium">{subscription.status === 'active' ? '✅ 活跃订阅' : '⚠️ 已取消'}</p>
              <p className="text-sm text-gray-500 mt-1">Plan ID: {subscription.plan_id}</p>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              暂无订阅
            </div>
          )}
        </div>

        {/* Available Plans */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            可用套餐
          </h2>
            {loading ? (
            <div className="text-center py-4">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div key={plan.id} className="app-panel p-6">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-3xl font-bold text-[#dc2626] mt-2">${plan.price}</p>
                  <p className="text-sm text-gray-500">{plan.billing_period === 'monthly' ? '月付' : '年付'}</p>
                  {plan.description && (
                    <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
                  )}
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!subscription}
                    className="mt-4 w-full px-4 py-2 bg-[#dc2626] text-white rounded-lg hover:bg-[#b91c1c] disabled:bg-gray-300"
                  >
                    {subscription ? '已订阅' : '订阅'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
};

export default BillingPage;
