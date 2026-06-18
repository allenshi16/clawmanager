export interface SubscriptionPlan {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  billing_period?: string;
  quota_cpu_cores: number;
  quota_memory_gb: number;
  quota_storage_gb: number;
  quota_tokens: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  stripe_subscription_id?: string;
  created_at?: string;
}

export interface Invoice {
  id: number;
  user_id: number;
  subscription_id?: number;
  invoice_number?: string;
  amount: number;
  currency?: string;
  status: string;
  issued_at?: string;
  due_at?: string;
  created_at?: string;
}

export interface BillingUsageSummary {
  subscription_status?: string;
  total_spent?: number;
  remaining_tokens?: number;
  [key: string]: any;
}
