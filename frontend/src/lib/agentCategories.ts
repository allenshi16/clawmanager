export interface AgentCategory {
  id: string;
  labelKey: string;
}

export const AGENT_CATEGORIES: AgentCategory[] = [
  { id: 'All', labelKey: 'marketplace.categories.all' },
  { id: 'Developer', labelKey: 'marketplace.categories.developer' },
  { id: 'Creative', labelKey: 'marketplace.categories.creative' },
  { id: 'Business', labelKey: 'marketplace.categories.business' },
  { id: 'Research', labelKey: 'marketplace.categories.research' },
];

export function deriveCategory(capabilities: string[]): string {
  if (capabilities.includes('self_improvement') || capabilities.includes('reasoning')) return 'Research';
  if (capabilities.includes('desktop') || capabilities.includes('v1_compatible')) return 'Developer';
  if (capabilities.includes('code')) return 'Developer';
  return 'Developer';
}

export function deriveIcon(capabilities: string[]): string {
  if (capabilities.includes('code') || capabilities.includes('v1_compatible')) return 'Code2';
  if (capabilities.includes('reasoning') || capabilities.includes('self_improvement')) return 'Sparkles';
  if (capabilities.includes('desktop')) return 'Monitor';
  if (capabilities.includes('chat')) return 'MessageSquare';
  return 'Cpu';
}
