import { apiRequest } from "./client";

export type BusinessProfile = {
  name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  updated_at: string;
};

export type BusinessProfileInput = Omit<BusinessProfile, "updated_at">;

export const businessProfileApi = {
  get: () => apiRequest<BusinessProfile>("/v1/business-profile/"),
  update: (body: BusinessProfileInput) =>
    apiRequest<BusinessProfile>("/v1/business-profile/", {
      method: "PATCH",
      body,
    }),
};
