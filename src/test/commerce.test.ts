import { describe, expect, it } from 'vitest';
import { MVOLA_NUMBER_DISPLAY, MVOLA_NAME, SHOP_WHATSAPP, normalizeWhatsapp, deliveryFee, variantPrice, paymentSummary, tracksStock, isShoeSizes, sizeLabel, orderMessage } from '../hype/commerce';
describe('HYPE commerce rules', () => {
  it('uses the requested Mvola number', () => expect(MVOLA_NUMBER_DISPLAY).toBe('034 16 686 61'));
  it('uses the requested Mvola recipient', () => expect(MVOLA_NAME).toBe('Tiavina Murielle'));
  it('keeps the WhatsApp contact unchanged', () => expect(SHOP_WHATSAPP).toBe('261381221950'));
  it('accepts the local WhatsApp format', () => expect(normalizeWhatsapp('0381221950')).toBe('0381221950'));
  it('accepts +261', () => expect(normalizeWhatsapp('+261 38 12 219 50')).toBe('0381221950'));
  it('accepts 261 without plus', () => expect(normalizeWhatsapp('261381221950')).toBe('0381221950'));
  it('accepts 00261 and +261 (0)', () => { expect(normalizeWhatsapp('00261 38 12 219 50')).toBe('0381221950'); expect(normalizeWhatsapp('+261 (0)38 12 219 50')).toBe('0381221950'); });
  it('accepts a number typed without the leading zero', () => expect(normalizeWhatsapp('38 12 219 50')).toBe('0381221950'));
  it('rejects incomplete numbers', () => expect(normalizeWhatsapp('+26138')).toBeNull());
  it('charges 3000 Ar for the city', () => expect(deliveryFee('ville')).toBe(3000));
  it('charges 4000 Ar for the outskirts', () => expect(deliveryFee('peripherie')).toBe(4000));
  it('uses a variant price', () => expect(variantPrice(95000, { p: 105000 })).toBe(105000));
  it('falls back to base price', () => expect(variantPrice(95000, {})).toBe(95000));
  it('takes 50% of articles only', () => expect(paymentSummary(95000, 'peripherie', '50')).toEqual({ subtotal: 95000, fee: 4000, paid: 47500, total: 99000, articleBalance: 47500, balance: 51500 }));
  it('full payment still leaves delivery payable to courier', () => expect(paymentSummary(95000, 'ville', '100').balance).toBe(3000));
  it('only tracks stock for DISPONIBLE DE SUITE', () => {
    expect(tracksStock('DISPONIBLE DE SUITE')).toBe(true);
    expect(tracksStock(' disponible de suite ')).toBe(true);
    expect(tracksStock('DROP')).toBe(false);
    expect(tracksStock('')).toBe(false);
    expect(tracksStock(undefined)).toBe(false);
  });
  it('detects shoe sizes (pointures)', () => {
    expect(isShoeSizes(['38', '39', '40'])).toBe(true);
    expect(isShoeSizes(['S', 'M'])).toBe(false);
    expect(isShoeSizes([])).toBe(false);
    expect(sizeLabel('41')).toBe('Pointure');
    expect(sizeLabel('M')).toBe('Taille');
  });
  it('writes the full WhatsApp order message with pointure, delivery and deposit', () => {
    const msg = orderMessage({
      no: 'HP-1', name: 'Rina', whatsapp: '0381221950', address: 'Analakely',
      items: [{ name: 'Sneakers HYPE', color: 'Noir', size: '41', q: 1, price: 100000 }],
      zone: 'ville', delivery_fee: 3000, subtotal: 100000, total: 103000, paid: 50000,
      balance: 53000, pay_mode: '50', mvola_ref: 'ABC123',
    });
    expect(msg).toContain('Pointure : 41');
    expect(msg).toContain('Rina');
    expect(msg).toContain('à payer au livreur le jour J de la livraison');
    expect(msg).toContain('Acompte de 50 %');
  });
});