import { describe, expect, it } from 'vitest';
import { normalizeWhatsapp, deliveryFee, variantPrice, paymentSummary } from '../hype/commerce';
describe('HYPE commerce rules', () => {
  it('accepts the local WhatsApp format', () => expect(normalizeWhatsapp('0381221950')).toBe('0381221950'));
  it('accepts +261', () => expect(normalizeWhatsapp('+261 38 12 219 50')).toBe('0381221950'));
  it('accepts 261 without plus', () => expect(normalizeWhatsapp('261381221950')).toBe('0381221950'));
  it('rejects incomplete numbers', () => expect(normalizeWhatsapp('+26138')).toBeNull());
  it('charges 3000 Ar for the city', () => expect(deliveryFee('ville')).toBe(3000));
  it('charges 4000 Ar for the outskirts', () => expect(deliveryFee('peripherie')).toBe(4000));
  it('uses a variant price', () => expect(variantPrice(95000, { p: 105000 })).toBe(105000));
  it('falls back to base price', () => expect(variantPrice(95000, {})).toBe(95000));
  it('takes 50% of articles only', () => expect(paymentSummary(95000, 'peripherie', '50')).toEqual({ subtotal: 95000, fee: 4000, paid: 47500, total: 99000, articleBalance: 47500, balance: 51500 }));
  it('full payment still leaves delivery payable to courier', () => expect(paymentSummary(95000, 'ville', '100').balance).toBe(3000));
});