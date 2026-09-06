import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { accessTokenStore } from "../api/client";
import { AuthProvider, useAuth } from "./AuthProvider";

function AuthProbe() {
  const auth = useAuth();
  if (auth.isLoading) return <div>loading</div>;
  return <div>{auth.user?.username ?? "anonymous"}</div>;
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  accessTokenStore.clear();
});

it("restores the authenticated user through the HttpOnly refresh cookie", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access: "restored-access" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "user-1",
          username: "tech",
          first_name: "",
          last_name: "",
          email: "",
          is_staff: true,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );

  expect(await screen.findByText("tech")).toBeInTheDocument();
  expect(accessTokenStore.get()).toBe("restored-access");
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/token/refresh/");
  expect(fetchMock.mock.calls[0]?.[1]).toEqual(
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
  expect(localStorage.getItem("techtrack.access")).toBeNull();
  expect(localStorage.getItem("techtrack.refresh")).toBeNull();
});
