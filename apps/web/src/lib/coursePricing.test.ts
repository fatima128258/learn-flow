import { describe, expect, it } from 'vitest';
import { getCoursePricing } from './coursePricing';

describe('getCoursePricing', () => {
  it('keeps the original and valid discounted prices separate', () => {
    expect(getCoursePricing(5000, 3500)).toEqual({
      originalPrice: 5000,
      currentPrice: 3500,
      hasDiscount: true,
    });
  });

  it('uses the original price when no discount exists', () => {
    expect(getCoursePricing(5000, null)).toEqual({
      originalPrice: 5000,
      currentPrice: 5000,
      hasDiscount: false,
    });
  });

  it('does not show an equal price as a discount', () => {
    expect(getCoursePricing(5000, 5000)).toEqual({
      originalPrice: 5000,
      currentPrice: 5000,
      hasDiscount: false,
    });
  });

  it('does not use a higher discount price as the sale price', () => {
    expect(getCoursePricing(5000, 6000)).toEqual({
      originalPrice: 5000,
      currentPrice: 5000,
      hasDiscount: false,
    });
  });
});
