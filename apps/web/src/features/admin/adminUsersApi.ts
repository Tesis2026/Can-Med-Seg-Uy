import {
  adminUserListSchema,
  adminUserSchema,
  type AdminUser,
  type CreateUserInput,
} from "@canmedseg/shared";

import { apiFetch } from "../../lib/api";

/** Gestión de usuarios del administrador (RF-11). */

export async function listUsers(): Promise<AdminUser[]> {
  return adminUserListSchema.parse(
    await apiFetch("/api/admin/users", { fallbackMessage: "No se pudo cargar el listado de usuarios." }),
  );
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  return adminUserSchema.parse(
    await apiFetch("/api/admin/users", {
      method: "POST",
      body: input,
      fallbackMessage: "No se pudo crear el usuario.",
    }),
  );
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/password`, {
    method: "POST",
    body: { password },
    fallbackMessage: "No se pudo cambiar la contraseña.",
  });
}

export async function setUserActive(userId: string, active: boolean): Promise<AdminUser> {
  return adminUserSchema.parse(
    await apiFetch(`/api/admin/users/${userId}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
      fallbackMessage: active ? "No se pudo activar el usuario." : "No se pudo desactivar el usuario.",
    }),
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
    fallbackMessage: "No se pudo borrar el usuario.",
  });
}
