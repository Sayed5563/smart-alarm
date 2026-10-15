import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkRow, PageHeader } from '@/components/PageHeader';
import { Settings } from '@/pages/Settings';

describe('PageHeader / LinkRow', () => {
  it('back is a real link to the parent page', () => {
    render(<PageHeader title="History" back="advanced" />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('#/settings/advanced');
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
  });
  it('a link row goes to its page', () => {
    render(<LinkRow label="Advanced" to="advanced" />);
    expect(screen.getByRole('link', { name: /Advanced/ }).getAttribute('href')).toBe('#/settings/advanced');
  });
});

describe('Settings views', () => {
  it('main shows the short list and links to Advanced; Advanced has the rest', () => {
    const { unmount } = render(<Settings view="main" />);
    expect(screen.getByRole('link', { name: /Advanced/ })).toBeTruthy();
    expect(screen.queryByText('Quiet hours')).toBeNull();
    unmount();
    render(<Settings view="advanced" />);
    expect(screen.getAllByText('Quiet hours').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /History/ })).toBeTruthy();
  });
});
