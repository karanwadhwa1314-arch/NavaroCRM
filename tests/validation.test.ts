import { describe, it, expect } from 'vitest';
import { createLeadSchema, leadListQuerySchema } from '@/lib/validation/lead';

describe('validation', () => {
  it('accepts emails with long TLDs (buyer@acme.trade)', () => {
    const result = createLeadSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      email: 'buyer@acme.trade',
      company: 'Acme Trading',
    });
    expect(result.success).toBe(true);
  });

  it('accepts other long/uncommon TLDs used in global trade (.global, .company)', () => {
    for (const email of ['buyer@acme.global', 'buyer@acme.company', 'buyer@acme.email']) {
      const result = createLeadSchema.safeParse({ firstName: 'A', lastName: 'B', email, company: 'Acme' });
      expect(result.success, `expected ${email} to be valid`).toBe(true);
    }
  });

  it('caps limit at 100 even when a larger value is requested', () => {
    const result = leadListQuerySchema.parse({ limit: '1000' });
    expect(result.limit).toBe(100);
  });

  it('falls back to the default sort field for an unknown sort value instead of rejecting the request', () => {
    const result = leadListQuerySchema.parse({ sort: 'not-a-real-field; DROP TABLE leads' });
    expect(result.sort).toBe('createdAt');
  });

  it('keeps a whitelisted sort field as-is', () => {
    const result = leadListQuerySchema.parse({ sort: 'company' });
    expect(result.sort).toBe('company');
  });
});
