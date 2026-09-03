import type { AlarmCategory } from '@/types';

export const CATEGORIES: { key: AlarmCategory; icon: string; labelKey: string }[] = [
  { key: 'work', icon: '💼', labelKey: 'category.work' },
  { key: 'school', icon: '🎓', labelKey: 'category.school' },
  { key: 'gym', icon: '💪', labelKey: 'category.gym' },
  { key: 'study', icon: '📚', labelKey: 'category.study' },
  { key: 'personal', icon: '⭐', labelKey: 'category.personal' },
  { key: 'other', icon: '⏰', labelKey: 'category.other' },
];

export function categoryIcon(key: AlarmCategory): string {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? '⏰';
}
