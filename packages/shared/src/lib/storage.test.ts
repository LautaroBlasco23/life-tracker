import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The storage facade resolves a platform adapter at import time. These tests
 * re-import the module under different global `localStorage` shapes, which is
 * exactly the static-export/Node-23 hazard the shape check guards against.
 */
function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
  };
}

describe("storage adapter resolution", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { localStorage?: unknown }).localStorage;
    vi.resetModules();
  });

  async function load() {
    return import("./storage");
  }

  it("uses the web localStorage adapter when it has the storage shape", async () => {
    const fake = fakeLocalStorage();
    vi.stubGlobal("localStorage", fake);
    const { storage } = await load();

    storage.setItem("probe", "value");
    expect(fake.data.get("probe")).toBe("value");
    expect(storage.getItem("probe")).toBe("value");
    storage.removeItem("probe");
    expect(fake.data.has("probe")).toBe(false);
  });

  it("falls back to a no-op adapter when localStorage is absent", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { storage } = await load();

    expect(storage.getItem("anything")).toBeNull();
    expect(() => storage.setItem("anything", "value")).not.toThrow();
    expect(() => storage.removeItem("anything")).not.toThrow();
  });

  it("rejects a truthy localStorage without a getItem function (Node 23 quirk)", async () => {
    vi.stubGlobal("localStorage", {});
    const { storage } = await load();

    expect(storage.getItem("anything")).toBeNull();
  });

  it("survives storage access that throws (disabled cookies)", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("access denied");
      },
    });

    const { storage } = await load();
    expect(storage.getItem("anything")).toBeNull();
  });

  it("lets hosts install their own adapter (native platforms)", async () => {
    const adapter = {
      getItem: vi.fn(() => "native"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const { storage, setStorageAdapter } = await load();

    setStorageAdapter(adapter);

    expect(storage.getItem("key")).toBe("native");
    storage.setItem("key", "next");
    storage.removeItem("key");
    expect(adapter.setItem).toHaveBeenCalledWith("key", "next");
    expect(adapter.removeItem).toHaveBeenCalledWith("key");
  });
});
