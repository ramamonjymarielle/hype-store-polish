export const SHOP_WHATSAPP = '261381221950';
export const MVOLA_NUMBER_DISPLAY = '034 16 686 61';
export const MVOLA_NAME = 'Tiavina Murielle';
export type DeliveryZone = 'ville' | 'peripherie';
export const formatAr = (value: number) => Math.round(value).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' Ar';
export function normalizeWhatsapp(value: string): string | null {
  // Accepte 038…, 38…, +261…, 261…, 00261…, +261 (0)38… avec espaces, points, tirets ou parenthèses.
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00261')) digits = digits.slice(2);
  if (digits.startsWith('2610')) digits = digits.slice(4);
  else if (digits.startsWith('261')) digits = digits.slice(3);
  if (digits.length === 9) digits = '0' + digits;
  return /^03[23478]\d{7}$/.test(digits) ? digits : null;
}
export function deliveryFee(zone: DeliveryZone | '') {
  return zone === 'peripherie' ? 4000 : zone === 'ville' ? 3000 : 0;
}
export function variantPrice(base: number, color?: { p?: number }) {
  return color?.p && color.p > 0 ? color.p : base;
}
export function paymentSummary(subtotal: number, zone: DeliveryZone | '', mode: '50' | '100') {
  const fee = deliveryFee(zone);
  const paid = mode === '50' ? Math.round(subtotal / 2) : subtotal;
  return { subtotal, fee, paid, total: subtotal + fee, articleBalance: subtotal - paid, balance: subtotal + fee - paid };
}
export function orderMessage(order: {
  no: string; name: string; whatsapp: string; address: string; notes?: string;
  items: { name: string; color: string; size: string | null; q: number; price: number }[];
  zone: string; delivery_fee: number; subtotal: number; total: number; paid: number;
  balance: number; pay_mode: string; mvola_ref: string;
}) {
  return [
    `Bonjour HYPE ! Commande ${order.no}`,
    `Client : ${order.name}`, `Téléphone WhatsApp : ${order.whatsapp}`, `Adresse : ${order.address}`,
    ...(order.notes ? [`Note : ${order.notes}`] : []), '', 'Articles :',
    ...order.items.map(item => `${item.q} × ${item.name} — ${item.color} — ${sizeLabel(item.size)} : ${item.size || 'Unique'} — ${formatAr(item.price)} / unité — ${formatAr(item.q * item.price)}`),
    '', `Sous-total articles : ${formatAr(order.subtotal)}`,
    `Zone : ${order.zone === 'peripherie' ? 'Périphérie / Environs' : 'Antananarivo ville'}`,
    `Frais de livraison : ${formatAr(order.delivery_fee)} à payer au livreur le jour J de la livraison`,
    `Total : ${formatAr(order.total)}`,
    `${order.pay_mode === '50' ? 'Acompte de 50 % sur les articles (hors livraison)' : 'Paiement intégral des articles'} déclaré : ${formatAr(order.paid)}`,
    `Référence Mvola : ${order.mvola_ref}`, `Solde articles : ${formatAr(order.subtotal - order.paid)}`,
    `Solde restant à payer au livreur (articles + livraison) : ${formatAr(order.balance)}`,
    'Commande à confirmer après vérification de la transaction Mvola.',
  ].join('\n');
}
/** Seuls les articles marqués « DISPONIBLE DE SUITE » ont un stock géré. Tous les autres sont sur commande (stock illimité). */
export function tracksStock(badge?: string | null): boolean {
  return (badge || '').trim().toUpperCase() === 'DISPONIBLE DE SUITE';
}

/** Pointures chaussures (35 à 42). */
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42'];

/** Vrai si la liste ne contient que des pointures numériques (ex : 38, 39, 40). */
export function isShoeSizes(sizes?: (string | null | undefined)[] | null): boolean {
  const list = (sizes || []).filter((x): x is string => Boolean(x));
  return list.length > 0 && list.every((x) => /^\d{2}$/.test(x));
}

export function sizeLabel(size?: string | null): string {
  return isShoeSizes([size]) ? 'Pointure' : 'Taille';
}
