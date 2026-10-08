import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCATION_KEY,
  PROVIDER_KEY,
  clearLocalData,
  isSavedLocation,
  loadProvider,
  loadSavedLocation,
  saveLocation,
  saveProvider,
  type SavedLocation,
} from "./saved-location";
import { getStorage, readJson, readString, removeKey, writeJson, writeString } from "./storage";

/** Minimal in-memory Storage. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

/** Storage that throws on every call, like Safari with storage blocked. */
class ThrowingStorage extends MemoryStorage {
  getItem(): string | null {
    throw new DOMException("denied", "SecurityError");
  }
  setItem(): void {
    throw new DOMException("full", "QuotaExceededError");
  }
  removeItem(): void {
    throw new DOMException("denied", "SecurityError");
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage", () => {
  it("is null on the server (no window)", () => {
    expect(getStorage()).toBeNull();
    expect(readString("x")).toBeNull();
    expect(writeString("x", "1")).toBe(false);
    expect(() => removeKey("x")).not.toThrow();
  });

  it("returns null when the localStorage getter throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(getStorage()).toBeNull();
  });

  it("uses window.localStorage when available", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(writeString("a", "1")).toBe(true);
    expect(storage.getItem("a")).toBe("1");
    expect(readString("a")).toBe("1");
    removeKey("a");
    expect(readString("a")).toBeNull();
  });

  it("swallows storage exceptions", () => {
    const storage = new ThrowingStorage();
    expect(readString("a", storage)).toBeNull();
    expect(writeString("a", "1", storage)).toBe(false);
    expect(() => removeKey("a", storage)).not.toThrow();
  });

  it("round-trips JSON and rejects bad shapes", () => {
    const storage = new MemoryStorage();
    const isNumberList = (v: unknown): v is number[] =>
      Array.isArray(v) && v.every((n) => typeof n === "number");
    expect(writeJson("list", [1, 2], storage)).toBe(true);
    expect(readJson("list", isNumberList, storage)).toEqual([1, 2]);
    storage.setItem("list", '["a"]');
    expect(readJson("list", isNumberList, storage)).toBeNull();
    storage.setItem("list", "{oops");
    expect(readJson("list", isNumberList, storage)).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson("c", circular, storage)).toBe(false);
  });
});

describe("saved location", () => {
  const location: SavedLocation = {
    address: "1060 W Addison St, Chicago, IL 60613",
    country: "US",
    postalCode: "60613",
    region: "IL",
    city: "Chicago",
    savedAt: "2026-10-08T15:00:00.000Z",
  };

  it("saves and loads under pr.location", () => {
    const storage = new MemoryStorage();
    expect(saveLocation({ ...location, address: `  ${location.address}  ` }, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(LOCATION_KEY) as string).address).toBe(location.address);
    expect(loadSavedLocation(storage)).toEqual(location);
  });

  it("ignores tampered or old-format values", () => {
    expect(isSavedLocation(location)).toBe(true);
    expect(isSavedLocation({ ...location, country: "usa" })).toBe(false);
    expect(isSavedLocation({ ...location, postalCode: 60613 })).toBe(false);
    expect(isSavedLocation({ ...location, address: "x".repeat(301) })).toBe(false);
    expect(isSavedLocation(null)).toBe(false);
    const storage = new MemoryStorage();
    storage.setItem(LOCATION_KEY, '"60613"');
    expect(loadSavedLocation(storage)).toBeNull();
  });

  it("remembers the email provider and clears everything", () => {
    const storage = new MemoryStorage();
    expect(loadProvider(storage)).toBeNull();
    saveProvider("outlook", storage);
    expect(loadProvider(storage)).toBe("outlook");
    storage.setItem(PROVIDER_KEY, "aol");
    expect(loadProvider(storage)).toBeNull();
    saveLocation(location, storage);
    storage.setItem("unrelated", "keep");
    clearLocalData(storage);
    expect(storage.getItem(LOCATION_KEY)).toBeNull();
    expect(storage.getItem(PROVIDER_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });
});
