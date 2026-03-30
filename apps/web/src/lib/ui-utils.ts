export function getImportanceDot(importance: string): string {
  switch (importance) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-amber-500';
    default: return 'bg-primary-500';
  }
}

export const CATEGORY_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500/20 text-blue-400',
  'crypto': 'bg-amber-500/20 text-amber-400',
  'derivatives': 'bg-emerald-500/20 text-emerald-400',
  'hk-stock': 'bg-rose-500/20 text-rose-400',
};

export const CATEGORY_DOT_COLORS: Record<string, string> = {
  'us-stock': 'bg-blue-500',
  'crypto': 'bg-amber-500',
  'derivatives': 'bg-emerald-500',
  'hk-stock': 'bg-rose-500',
};
