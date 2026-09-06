import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  accessTokenStore,
  apiRequest,
  AUTH_EXPIRED_EVENT,
  clearLegacyTokenStorage,
} from "./client";

describe("apiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    accessTokenStore.clear();
  });

  it("refreshes the in-memory access token once on 401 and retries the request", async () => {
    accessTokenStore.set("old-access");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access: "new-access" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ ok: boolean }>("/v1/customers/");

    expect(result.ok).toBe(true);
    expect(accessTokenStore.get()).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/token/refresh/");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
      }),
    );
    expect(localStorage.getItem("techtrack.access")).toBeNull();
    expect(localStorage.getItem("techtrack.refresh")).toBeNull();
  });

  it("clears the access token and emits an auth-expired event when cookie refresh fails", async () => {
    accessTokenStore.set("expired-access");
    const authExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, authExpired);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "expired" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "invalid" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/v1/customers/")).rejects.toMatchObject({
      status: 401,
    });

    expect(accessTokenStore.get()).toBeNull();
    expect(authExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, authExpired);
  });

  it("purges tokens left by the legacy localStorage session", () => {
    localStorage.setItem("techtrack.access", "legacy-access");
    localStorage.setItem("techtrack.refresh", "legacy-refresh");

    clearLegacyTokenStorage();

    expect(localStorage.getItem("techtrack.access")).toBeNull();
    expect(localStorage.getItem("techtrack.refresh")).toBeNull();
  });
});
