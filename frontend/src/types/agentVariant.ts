export interface AgentVariantTemplate {
  id: number;
  name: string;
  slug: string;
  description?: string;
  runtime_type: string;
  image_registry?: string;
  image_tag?: string;
  skill_ids: number[];
  config_plan?: {
    mode?: string;
    bundle_id?: number;
    resource_ids?: number[];
  };
  icon: string;
  category: string;
  is_public: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;

  recommended_cpu: number;
  recommended_memory: number;
  recommended_disk: number;
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  review_status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: number;
  reviewed_at?: string;
  review_comment?: string;
  readme_md?: string;
  screenshot_urls?: string;
  version: number;
  source_template_id?: number;
  usage_count: number;
}

export interface CreateVariantTemplateRequest {
  name: string;
  slug: string;
  description?: string;
  runtime_type: string;
  image_registry?: string;
  image_tag?: string;
  skill_ids: number[];
  config_plan?: Record<string, unknown>;
  icon?: string;
  category?: string;
  is_public?: boolean;
  recommended_cpu?: number;
  recommended_memory?: number;
  recommended_disk?: number;
  readme_md?: string;
  screenshot_urls?: string;
}

export interface AgentVariantTemplateVersion {
  id: number;
  template_id: number;
  version: number;
  snapshot_json: string;
  changelog?: string;
  created_at: string;
}

export interface TemplateStats {
  total_templates: number;
  status_counts: Record<string, number>;
  total_usage_count: number;
  total_forks: number;
  most_popular: AgentVariantTemplate[];
  recent_templates: AgentVariantTemplate[];
}

export interface UpgradeCheckResult {
  instance_id: number;
  variant_id?: number;
  variant_name?: string;
  current_version?: number;
  latest_version?: number;
  upgrade_available: boolean;
}

export interface VersionDiff {
  version_a: number;
  version_b: number;
  changes: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
  change_count: number;
}

export interface BulkOperationRequest {
  ids: number[];
}

export interface UpdateVariantTemplateRequest {
  name?: string;
  slug?: string;
  description?: string;
  runtime_type?: string;
  image_registry?: string;
  image_tag?: string;
  skill_ids?: number[];
  config_plan?: Record<string, unknown> | null;
  icon?: string;
  category?: string;
  is_public?: boolean;
  recommended_cpu?: number;
  recommended_memory?: number;
  recommended_disk?: number;
  readme_md?: string;
  screenshot_urls?: string;
}
