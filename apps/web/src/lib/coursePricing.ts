export interface CoursePricing {
  originalPrice: number | null;
  currentPrice: number | null;
  hasDiscount: boolean;
}

export function getCoursePricing(
  price: number | null,
  discountPrice: number | null,
): CoursePricing {
  const hasDiscount = price !== null && discountPrice !== null && discountPrice < price;

  return {
    originalPrice: price,
    currentPrice: hasDiscount ? discountPrice : price,
    hasDiscount,
  };
}
