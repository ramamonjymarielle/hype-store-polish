export const SHOP_WHATSAPP = '261381221950';
export type DeliveryZone = 'ville' | 'peripherie';
export const formatAr = (value: number) => Math.round(value).toLocaleString('fr-FR').replace(/\u202f/g, ' ') + ' Ar';
export function normalizeWhatsapp(value: string): string | null {
  let digits = value.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (digits.startsWith('261')) digits = '0' + digits.slice(3);
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
    ...order.items.map(item => `${item.q} × ${item.name} — ${item.color} — Taille : ${item.size || 'Unique'} — ${formatAr(item.price)} / unité — ${formatAr(item.q * item.price)}`),
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