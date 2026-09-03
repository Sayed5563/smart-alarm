import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateService } from '@/services/updateService';

describe('updateService', () => {
  beforeEach(() => updateService.setRegistration(undefined));

  it('reports unsupported when no service worker is registered', async () => {
    expect(updateService.isSupported()).toBe(false);
    expect(await updateService.check()).toBe('unsupported');
  });

  it('reports current when update() resolves with nothing new', async () => {
    updateService.setRegistration({
      update: vi.fn().mockResolvedValue(undefined),
      installing: null,
      waiting: null,
    } as unknown as ServiceWorkerRegistration);
    expect(await updateService.check()).toBe('current');
  });

  it('reports updating when a new worker is installing', async () => {
    updateService.setRegistration({
      update: vi.fn().mockResolvedValue(undefined),
      installing: {} as ServiceWorker,
      waiting: null,
    } as unknown as ServiceWorkerRegistration);
    expect(await updateService.check()).toBe('updating');
  });

  it('reports offline when update() throws', async () => {
    updateService.setRegistration({
      update: vi.fn().mockRejectedValue(new Error('network')),
      installing: null,
      waiting: null,
    } as unknown as ServiceWorkerRegistration);
    expect(await updateService.check()).toBe('offline');
  });
});
