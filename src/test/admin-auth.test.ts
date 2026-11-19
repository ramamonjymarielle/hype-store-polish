import { describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signInWithOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
import { signInAdminWithPassword } from '@/hype/adminAuth';
describe('Password-only admin access', () => {
  it('rejects an incorrect password without sending an email code', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    await expect(signInAdminWithPassword('owner@example.test', 'invalid-test-password')).rejects.toThrow();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
});