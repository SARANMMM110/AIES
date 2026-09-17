import type { User } from "@aes/database";

type PublicUserSource = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "role" | "isActive" | "createdAt"
>;

export function toPublicUser(user: PublicUserSource) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export function ok<T>(data: T) {
  return { success: true as const, data };
}
