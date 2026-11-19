import { supabase } from '@/integrations/supabase/client';
import type { RawProduct } from './App';

/** Confirm a fresh database read before reporting that a product is saved. */
export async function persistCatalogProduct(product: RawProduct, sort: number): Promise<void> {
  const { error } = await supabase.from('products').upsert({
    id: product.id,
    data: product as unknown as import('@/integrations/supabase/types').Json,
    sort,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Article non enregistré : ' + error.message);
  const { data, error: readError } = await supabase.from('products').select('data').eq('id', product.id).single();
  if (readError || !data || JSON.stringify(canonical(data.data)) !== JSON.stringify(canonical(product))) {
    throw new Error('La sauvegarde de cet article n’a pas pu être confirmée. Gardez cette page ouverte et réessayez.');
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}