import { ApiError } from "../api/client";

function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return null;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.data === "string") return error.data;
    if (error.data && typeof error.data === "object") {
      const data = error.data as Record<string, unknown>;
      const detail = firstMessage(data.detail);
      if (detail) return detail;

      for (const value of Object.values(data)) {
        const message = firstMessage(value);
        if (message) return message;
      }
    }
    return "Nao foi possivel concluir a operacao.";
  }
  if (error instanceof Error) return error.message;
  return "Erro inesperado.";
}
