import { describe, it, expect } from "vitest";
import {
  ACCOUNT_RETURN_KEY,
  rememberCookReturn,
  takeCookReturn,
} from "../src/auth/returnToCook";
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};
describe("account return hints", () => {
  it("returns to the same cook once without holding cook content or tokens", () => {
    const storage = memory();
    rememberCookReturn(storage, "cooking", "cook-a", 100);
    expect(takeCookReturn(storage, "cook-a", 200)).toBe("cooking");
    expect(takeCookReturn(storage, "cook-a", 201)).toBeNull();
  });
  it("rejects another cook, old hints, future hints, malformed JSON and arbitrary destinations", () => {
    for (const raw of [
      JSON.stringify({ view: "cooking", cookId: "other", at: 100 }),
      JSON.stringify({ view: "planning", cookId: "a", at: 0 }),
      JSON.stringify({ view: "history", cookId: "a", at: 5000000 }),
      JSON.stringify({
        view: "https://evil.example",
        cookId: "a",
        at: 4000000,
      }),
      "not json",
      "null",
    ]) {
      const storage = memory();
      storage.setItem(ACCOUNT_RETURN_KEY, raw);
      expect(takeCookReturn(storage, "a", 4000001)).toBeNull();
      expect(storage.getItem(ACCOUNT_RETURN_KEY)).toBeNull();
    }
  });
  it("does not require tab storage to be available", () => {
    const storage = {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
      removeItem: () => {
        throw Error("blocked");
      },
    };
    expect(() => rememberCookReturn(storage, "home", "a")).not.toThrow();
    expect(takeCookReturn(storage, "a")).toBeNull();
  });
});
