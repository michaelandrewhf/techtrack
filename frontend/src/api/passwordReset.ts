import { apiRequest } from "./client";

type MessageResponse = {
  message: string;
};

export function requestPasswordReset(email: string) {
  return apiRequest<MessageResponse>("/v1/auth/password-reset/", {
    method: "POST",
    body: { email },
    skipAuth: true,
    retry: false,
  });
}

export function confirmPasswordReset(payload: {
  uid: string;
  token: string;
  new_password: string;
  confirm_password: string;
}) {
  return apiRequest<MessageResponse>("/v1/auth/password-reset/confirm/", {
    method: "POST",
    body: payload,
    skipAuth: true,
    retry: false,
  });
}
