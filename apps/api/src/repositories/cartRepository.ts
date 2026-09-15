import getPrisma from '../prisma';

export async function getOrCreateCart(userId: string, organizationId: string) {
  return getPrisma().cart.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId },
    update: {},
    include: { items: { include: { course: true } } },
  });
}

export async function addCourseToCart(userId: string, organizationId: string, courseId: string) {
  const cart = await getOrCreateCart(userId, organizationId);
  await getPrisma().cartItem.upsert({
    where: { cartId_courseId: { cartId: cart.id, courseId } },
    create: { cartId: cart.id, courseId },
    update: {},
  });
  return getOrCreateCart(userId, organizationId);
}
