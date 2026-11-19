import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawProduct } from '@/hype/App';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), single: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({
  upsert: mocks.upsert,
  select: () => ({ eq: () => ({ single: mocks.single }) }),
}) } }));
import { persistCatalogProduct } from '@/hype/catalogPersistence';

const product: RawProduct = { id: 100, name: 'Hoodie', category: 'Hoodies', price: 65000, descr: '', visible: true, sizes: ['S'], colors: [{ n: 'Noir', h: '#000000', i: ['data:image/jpeg;base64,photo'], st: 3 }] };
describe('Durable catalog saves', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); });
  it('confirms all product data including photos through a fresh Cloud read', async () => {
    mocks.single.mockResolvedValue({ data: { data: { ...product, original_price: undefined } }, error: null });
    await persistCatalogProduct(product, 4);
    expect(mocks.upsert.mock.calls[0]?.[0]).toMatchObject({ id: 100, data: product, sort: 4 });
    expect(mocks.single).toHaveBeenCalledOnce();
  });
  it('rejects a write failure instead of claiming the product is saved', async () => {
    mocks.upsert.mockResolvedValue({ error: { message: 'Permission denied' } });
    await expect(persistCatalogProduct(product, 4)).rejects.toThrow('Article non enregistré');
    expect(mocks.single).not.toHaveBeenCalled();
  });
  it('rejects a missing or different persisted product', async () => {
    mocks.single.mockResolvedValue({ data: { data: { ...product, price: 1 } }, error: null });
    await expect(persistCatalogProduct(product, 4)).rejects.toThrow('sauvegarde');
  });
});