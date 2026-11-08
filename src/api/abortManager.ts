// 考慮到 exact-match 對動態 path 失效
type AbortRule = {
  method: "POST" | "GET" | "PUT" | "DELETE";
  pattern: RegExp;
};
export const ABORT_WHITELIST: AbortRule[] = [];

export const isAbortWhitelist = (method: string, path: string): boolean =>
  ABORT_WHITELIST.some(
    (rule) => rule.method === method.toUpperCase() && rule.pattern.test(path),
  );

const keyMap = new Map<string, Set<AbortController>>();
const controllers = new Set<AbortController>();

export const track = (abortController: AbortController, key?: string) => {
  if (key) {
    const [method, path] = key.split(" ");
    if (isAbortWhitelist(method, path)) return;
  }
  controllers.add(abortController);
  if (!key) return;
  if (!keyMap.has(key)) keyMap.set(key, new Set());
  keyMap.get(key)!.add(abortController);
};

export const untrack = (abortController: AbortController) => {
  controllers.delete(abortController);
  keyMap.forEach((set, key) => {
    set.delete(abortController);
    if (set.size === 0) keyMap.delete(key);
  });
};

// 測試用
export const abortAll = () => {
  controllers.forEach((controller) => controller.abort());
  controllers.clear();
  keyMap.clear();
};

export const abortKey = (key: string) => {
  const set = keyMap.get(key);
  if (!set) return;
  set.forEach((controller) => {
    controller.abort();
    controllers.delete(controller);
  });
  keyMap.delete(key);
};

// 測試用
export const getTrackingStats = () => ({
  controllers: controllers.size,
  keys: keyMap.size,
});
