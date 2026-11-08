import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abortAll, getTrackingStats } from "../../api/abortManager";
import instance, { plainClient } from "../../api/axios";
import { SEND_GAP_MS, useProductRace } from "../../composables/useProductRace";
import { createDeferredAdapter, type DeferredCall } from "../deferredAdapter";

const phone = { products: [{ id: 1, title: "iPhone", price: 1 }], total: 1 };
const laptop = { products: [{ id: 2, title: "MacBook", price: 2 }], total: 1 };

let rawCalls: DeferredCall[];
let guardedCalls: DeferredCall[];

// 每筆查詢依 plain、requestId、guarded 的順序送出，前兩者共用 plainClient
const plainCall = (n: number) => rawCalls[n * 2];
const requestIdCall = (n: number) => rawCalls[n * 2 + 1];
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  const raw = createDeferredAdapter();
  const guarded = createDeferredAdapter();
  rawCalls = raw.calls;
  guardedCalls = guarded.calls;
  plainClient.defaults.adapter = raw.adapter;
  instance.defaults.adapter = guarded.adapter;
});

afterEach(() => {
  abortAll();
  vi.useRealTimers();
});

describe("useProductRace", () => {
  it("plain panel ends on the stale response", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    plainCall(1).respond(laptop);
    await settle();
    expect(race.plain.value.shownQuery).toBe("laptop");
    plainCall(0).respond(phone);
    await settle();
    expect(race.plain.value.shownQuery).toBe("phone");
    expect(race.plain.value.products).toEqual(phone.products);
  });

  it("previous panel ignores the stale response but lets the request finish", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    requestIdCall(1).respond(laptop);
    await settle();
    requestIdCall(0).respond(phone);
    await settle();
    expect(race.requestId.value.shownQuery).toBe("laptop");
    expect(race.requestId.value.products).toEqual(laptop.products);
    expect(race.requestId.value.log.map((entry) => entry.status)).toEqual([
      "ignored",
      "success",
    ]);
    expect(requestIdCall(0).config.signal?.aborted ?? false).toBe(false);
  });

  it("guarded panel keeps the latest result and cancels the old request", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    guardedCalls[1].respond(laptop);
    await settle();
    expect(guardedCalls[0].config.signal?.aborted).toBe(true);
    expect(race.guarded.value.shownQuery).toBe("laptop");
    expect(race.guarded.value.log.map((entry) => entry.status)).toEqual([
      "canceled",
      "success",
    ]);
  });

  it("the guarded side never cancels the plain side", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    expect(plainCall(0).config.signal?.aborted ?? false).toBe(false);
    expect(race.plain.value.log.map((entry) => entry.status)).toEqual([
      "pending",
      "pending",
    ]);
  });

  it("a late reply to a canceled request changes nothing", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    guardedCalls[1].respond(laptop);
    await settle();
    guardedCalls[0].respond(phone);
    await settle();
    expect(race.guarded.value.shownQuery).toBe("laptop");
  });

  it("each panel sends a different URL so the browser does not queue them", async () => {
    const race = useProductRace();
    race.start();
    await settle();
    const panels = [plainCall(0), requestIdCall(0), guardedCalls[0]].map(
      (call) => call.config.params.panel,
    );
    expect(new Set(panels).size).toBe(3);
  });

  it("start is ignored while running", async () => {
    const race = useProductRace();
    race.start();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    expect(rawCalls).toHaveLength(4);
    expect(guardedCalls).toHaveLength(2);
  });

  it("an HTTP failure becomes an error row and running ends", async () => {
    const race = useProductRace();
    race.start();
    await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
    plainCall(0).fail(429);
    plainCall(1).fail(429);
    requestIdCall(0).fail(429);
    requestIdCall(1).fail(429);
    guardedCalls[1].fail(429);
    await settle();
    expect(race.plain.value.log.map((entry) => entry.status)).toEqual([
      "error",
      "error",
    ]);
    expect(race.plain.value.log[0].message).toContain("429");
    expect(race.plain.value.shownQuery).toBeNull();
    expect(race.running.value).toBe(false);
  });

  it("a second run clears the previous run and leaks nothing", async () => {
    const race = useProductRace();
    for (const offset of [0, 2]) {
      race.start();
      await vi.advanceTimersByTimeAsync(SEND_GAP_MS);
      plainCall(offset).respond(phone);
      plainCall(offset + 1).respond(laptop);
      requestIdCall(offset).respond(phone);
      requestIdCall(offset + 1).respond(laptop);
      guardedCalls[offset + 1].respond(laptop);
      await settle();
      expect(race.plain.value.log).toHaveLength(2);
    }
    expect(getTrackingStats()).toEqual({ controllers: 0, keys: 0 });
  });
});
