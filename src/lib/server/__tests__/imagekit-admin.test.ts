import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteImageKitFiles } from "../imagekit-admin";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("deleteImageKitFiles", () => {
  it("does nothing without a private key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "");
    await deleteImageKitFiles(["abc"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes each distinct file once, with basic auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "private_key");
    await deleteImageKitFiles(["a", "a", "", "b"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.imagekit.io/v1/files/a");
    expect(init.method).toBe("DELETE");
    expect(init.headers.authorization).toBe(`Basic ${Buffer.from("private_key:").toString("base64")}`);
  });

  it("never throws when ImageKit is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubEnv("IMAGEKIT_PRIVATE_KEY", "private_key");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteImageKitFiles(["a"])).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
