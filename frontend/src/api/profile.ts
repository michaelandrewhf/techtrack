import { apiRequest } from "./client";
import type { User } from "./types";

export type EditableProfile = Pick<
  User,
  "username" | "first_name" | "last_name" | "email"
>;

export const profileApi = {
  update: (body: EditableProfile) =>
    apiRequest<User>("/v1/me/", { method: "PATCH", body }),
};
