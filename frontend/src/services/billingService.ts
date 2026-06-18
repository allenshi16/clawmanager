import type { SubscriptionPlan, UserSubscription, Invoice, BillingUsageSummary } from '../types/billing';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

export const billingService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const response = await fetch(`${API_URL}/billing/plans`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch plans');
    return response.json();
  },

  async getSubscription(): Promise<UserSubscription | null> {
    const response = await fetch(`${API_URL}/billing/subscription`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch subscription');
    return response.json();
  },

  async createSubscription(planId: number): Promise<UserSubscription> {
    const response = await fetch(`${API_URL}/billing/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ plan_id: planId }),
    });
    if (!response.ok) throw new Error('Failed to create subscription');
    return response.json();
  },

  async cancelSubscription(): Promise<void> {
    const response = await fetch(`${API_URL}/billing/subscribe`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to cancel subscription');
  },

  async getInvoices(limit: number = 20): Promise<Invoice[]> {
    const response = await fetch(`${API_URL}/billing/invoices?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return response.json();
  },

  async getUsageSummary(): Promise<BillingUsageSummary | null> {
    const response = await fetch(`${API_URL}/billing/usage`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch usage summary');
    return response.json();
  },
};
