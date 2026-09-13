export function getActiveCoursePrice(
  price: number | null | undefined,
  discountPrice: number | null | undefined,
): number {
  if (price == null) return 0;
  return discountPrice != null && discountPrice < price ? discountPrice : price;
}
