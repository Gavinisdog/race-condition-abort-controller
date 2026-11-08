import axios, { type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ABORT_WHITELIST,
  abortAll,
  abortKey,
  getTrackingStats,
} from "../../api/abortManager";
import instance, { plainClient } from "../../api/axios";
import { searchProducts } from "../../api/products";
import { createDeferredAdapter, type DeferredCall } from "../deferredAdapter";

const flush = () => new Promise((resolve) => setTimeout(resolve));

let adapter: AxiosAdapter;
let calls: DeferredCall[];

beforeEach(() => {
  ({ adapter, calls } = createDeferredAdapter());
  instance.defaults.adapter = adapter;
});

afterEach(() => abortAll());

describe("axios interceptors", () => {
  it("cancelPrevious aborts the earlier request on the same path, even with different params", async () => {
    const first = instance.get("/products/search", {
      params: { q: "phone" },
      cancelPrevious: true,
    });
    // 取消前先掛上斷言，否則 Vitest 會回報 unhandled rejection，整體 exit 1
    const firstCanceled = expect(first).rejects.toSatisfy(axios.isCancel);
    await flush();
    const second = instance.get("/products/search", {
      params: { q: "laptop" },
      cancelPrevious: true,
    });
    await flush();
    await firstCanceled;
    calls[1].respond({ total: 1 });
    await expect(second).resolves.toMatchObject({ data: { total: 1 } });
  });

  it("same-path requests without cancelPrevious do not abort each other", async () => {
    const first = instance.get("/products/search");
    const second = instance.get("/products/search");
    await flush();
    calls[0].respond({});
    calls[1].respond({});
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("cancelPrevious leaves other paths alone", async () => {
    const other = instance.get("/products/1");
    await flush();
    const search = instance.get("/products/search", { cancelPrevious: true });
    await flush();
    calls[0].respond({});
    calls[1].respond({});
    await expect(Promise.all([other, search])).resolves.toHaveLength(2);
  });

  it("stops tracking after success, failure and cancel", async () => {
    const ok = instance.get("/a");
    const bad = instance.get("/b");
    const canceled = instance.get("/c");
    await flush();
    expect(getTrackingStats().controllers).toBe(3);
    calls[0].respond({});
    calls[1].fail(503);
    abortKey("get /c");
    await Promise.allSettled([ok, bad, canceled]);
    expect(getTrackingStats()).toEqual({ controllers: 0, keys: 0 });
  });

  it("does not track whitelisted requests", async () => {
    ABORT_WHITELIST.push({ method: "GET", pattern: /^\/safe$/ });
    const safe = instance.get("/safe");
    await flush();
    abortAll();
    calls[0].respond({});
    await expect(safe).resolves.toBeDefined();
    ABORT_WHITELIST.length = 0;
  });

  it("leaves a caller-provided signal alone", async () => {
    const own = new AbortController();
    const request = instance.get("/a", { signal: own.signal });
    await flush();
    expect(getTrackingStats().controllers).toBe(0);
    own.abort();
    await expect(request).rejects.toSatisfy(axios.isCancel);
  });

  it("plainClient is never tracked", async () => {
    plainClient.defaults.adapter = adapter;
    const request = plainClient.get("/products/search");
    await flush();
    expect(getTrackingStats().controllers).toBe(0);
    abortKey("get /products/search");
    calls[0].respond({});
    await expect(request).resolves.toBeDefined();
  });
});

describe("searchProducts", () => {
  it("sends the pinned params and returns the body", async () => {
    const request = searchProducts(instance, {
      keyword: "phone",
      delay: 3000,
      panel: "abort",
    });
    await flush();
    expect(calls[0].config.url).toBe("/products/search");
    expect(calls[0].config.params).toEqual({
      q: "phone",
      delay: 3000,
      panel: "abort",
      limit: 3,
      select: "title,price",
    });
    calls[0].respond({ products: [], total: 0 });
    await expect(request).resolves.toEqual({ products: [], total: 0 });
  });
});
