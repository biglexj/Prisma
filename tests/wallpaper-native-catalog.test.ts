import { afterEach, expect, mock, test } from "bun:test";

const invoke = mock(async (_command: string, _args?: unknown): Promise<unknown> => ({}));
const core = await import("@tauri-apps/api/core");
mock.module("@tauri-apps/api/core", () => ({ ...core, invoke, isTauri: () => true }));
const { fetchAuroraWallpapers } = await import("../src/features/wallpapers/services/wallpapersApi");
afterEach(() => invoke.mockReset());

test("desktop sends filters to the native authenticated catalog without exposing credentials", async () => {
  invoke.mockResolvedValueOnce({ success: true, wallpapers: [
    { id: "public", isAuthorized: true, isPremium: false },
    { id: "premium", isAuthorized: true, isPremium: true },
    { id: "denied", isAuthorized: false, isPremium: true },
  ] });
  const response = await fetchAuroraWallpapers({ visibility: "premium", ratio: "16:9" });
  expect(invoke).toHaveBeenCalledWith("aurora_wallpapers_catalog", { options: { visibility: "premium", ratio: "16:9" } });
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(response.wallpapers.map(wp => wp.id)).toEqual(["premium"]);
});

test("authentication failure is reported instead of silently becoming a guest", async () => {
  invoke.mockRejectedValueOnce(new Error("Verifica tu sesión"));
  await expect(fetchAuroraWallpapers({ visibility: "all" })).rejects.toThrow("Verifica tu sesión");
  expect(invoke).toHaveBeenCalledTimes(1);
});

test("cancelled native results cannot replace a newer catalog", async () => {
  const controller = new AbortController();
  invoke.mockImplementationOnce(async () => { controller.abort(); return { success: true, wallpapers: [] }; });
  await expect(fetchAuroraWallpapers({}, controller.signal)).rejects.toThrow();
});
