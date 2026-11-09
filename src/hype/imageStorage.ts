import { supabase } from '@/integrations/supabase/client';

export const PRODUCT_IMAGE_BUCKET = 'product-images';

export const isDataUrl = (value: string): boolean => value.startsWith('data:image/');

/**
 * Envoie une image (data-URL) vers Supabase Storage et renvoie son lien public.
 * Le catalogue ne garde alors qu'un petit lien au lieu de milliers de caractères base64 :
 * le site se charge beaucoup plus vite, surtout en 4G.
 * Si l'envoi échoue (bucket absent, hors-ligne…), l'image d'origine est conservée pour ne rien casser.
 */
export async function hostProductImage(value: string): Promise<{ url: string; hosted: boolean }> {
  if (!isDataUrl(value)) return { url: value, hosted: true };
  try {
    const blob = await (await fetch(value)).blob();
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, hosted: true };
  } catch (error) {
    console.warn('Envoi de la photo vers le stockage impossible, image conservée en local :', error);
    return { url: value, hosted: false };
  }
}
