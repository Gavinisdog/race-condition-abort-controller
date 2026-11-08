import { afterEach, describe, expect, it } from "vitest";
import {
  abortAll,
  abortKey,
  getTrackingStats,
  track,
  untrack,
} from "../../api/abortManager";

afterEach(() => abortAll());

describe("abortManager", () => {
  it("abortKey aborts that key only and forgets it", () => {
    const a = new AbortController();
    const b = new AbortController();
    track(a, "get /x");
    track(b, "get /y");
    abortKey("get /x");
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
    expect(getTrackingStats()).toEqual({ controllers: 1, keys: 1 });
  });

  it("abortAll aborts everything and clears both collections", () => {
    const a = new AbortController();
    const b = new AbortController();
    track(a, "get /x");
    track(b);
    abortAll();
    expect(a.signal.aborted && b.signal.aborted).toBe(true);
    expect(getTrackingStats()).toEqual({ controllers: 0, keys: 0 });
  });

  it("untrack forgets without aborting and removes the empty key", () => {
    const a = new AbortController();
    track(a, "get /x");
    untrack(a);
    expect(a.signal.aborted).toBe(false);
    expect(getTrackingStats()).toEqual({ controllers: 0, keys: 0 });
  });

  it("untrack after abortKey is safe", () => {
    const a = new AbortController();
    track(a, "get /x");
    abortKey("get /x");
    untrack(a);
    expect(getTrackingStats()).toEqual({ controllers: 0, keys: 0 });
  });

  it("abortKey on an unknown key does nothing", () => {
    expect(() => abortKey("get /missing")).not.toThrow();
  });
});
