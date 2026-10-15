import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useStore } from '@/store/useStore';
import { DEFAULT_SETTINGS } from '@/data/defaults';
import { QuickSet } from '@/components/QuickTimer';
import { nextInKey } from '@/utils/alarmList';

vi.mock('@/services', async (orig) => ({ ...(await orig<typeof import('@/services')>()) }));

beforeEach(() => {
  useStore.setState({ alarms: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), lastToast: null });
});

describe('quick alarms', () => {
  it('the toast offers Undo, which removes the alarm it just added', () => {
    render(<QuickSet />);
    fireEvent.click(screen.getByText('+5'));
    expect(useStore.getState().alarms).toHaveLength(1);
    const toast = useStore.getState().lastToast!;
    expect(toast.action?.label).toBe('Undo');
    toast.action!.run();
    expect(useStore.getState().alarms).toHaveLength(0);
  });
});

describe('nextInKey', () => {
  it('says what is coming next', () => {
    expect(nextInKey('alarm')).toBe('alarms.nextIn');
    expect(nextInKey('pre-alarm')).toBe('alarms.preAlarmIn');
    expect(nextInKey('snooze')).toBe('alarms.snoozeIn');
  });
});
