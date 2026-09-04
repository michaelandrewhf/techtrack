import { ApiError } from "../api/client";

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.data === "string") return error.data;
    if (
      error.data &&
      typeof error.data === "object" &&
      "detail" in error.data
    ) {
      return String((error.data as { detail: unknown }).detail);
    }
    return "Nao foi possivel concluir a operacao.";
  }
  if (error instanceof Error) return error.message;
  return "Erro inesperado.";
}
