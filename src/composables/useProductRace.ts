import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { computed, ref, type Ref } from "vue";
import instance, { plainClient } from "../api/axios";
import {
  searchProducts,
  type Product,
  type ProductQuery,
} from "../api/products";

export type RequestStatus =
  | "pending"
  | "success"
  | "ignored"
  | "canceled"
  | "error";

export type RequestLog = {
  id: number;
  keyword: string;
  delay: number;
  status: RequestStatus;
  usedMs: number | null;
  message?: string;
};

export type PanelState = {
  shownQuery: string | null;
  products: Product[];
  log: RequestLog[];
};

type Strategy = {
  panel: string;
  client: AxiosInstance;
  config?: AxiosRequestConfig;
  ignoreStale?: boolean;
};

type Lane = { state: Ref<PanelState>; latestId: number; strategy: Strategy };

export const requestList: ProductQuery[] = [
  { keyword: "phone", delay: 3000 },
  { keyword: "laptop", delay: 500 },
];

export const SEND_GAP_MS = 300;

const emptyPanel = (): PanelState => ({
  shownQuery: null,
  products: [],
  log: [],
});

const createPanel = () => ref<PanelState>(emptyPanel());

export const useProductRace = () => {
  const plain = createPanel();
  const requestId = createPanel();
  const guarded = createPanel();

  const lanes: Lane[] = [
    {
      state: plain,
      latestId: 0,
      strategy: { panel: "plain", client: plainClient },
    },
    {
      state: requestId,
      latestId: 0,
      strategy: { panel: "previous", client: plainClient, ignoreStale: true },
    },
    {
      state: guarded,
      latestId: 0,
      strategy: {
        panel: "abort",
        client: instance,
        config: { cancelPrevious: true },
      },
    },
  ];

  const waitingForNext = ref(false);

  const running = computed(
    () =>
      waitingForNext.value ||
      lanes.some(({ state }) =>
        state.value.log.some((entry) => entry.status === "pending"),
      ),
  );

  const send = async (lane: Lane, query: ProductQuery) => {
    const { state, strategy } = lane;
    const id = ++lane.latestId;
    const entry = ref<RequestLog>({
      id,
      ...query,
      status: "pending",
      usedMs: null,
    });
    state.value.log.push(entry.value);
    const startedAt = Date.now();

    try {
      const result = await searchProducts(
        strategy.client,
        { ...query, panel: strategy.panel },
        strategy.config,
      );

      if (strategy.ignoreStale && id !== lane.latestId) {
        entry.value.status = "ignored";
        return;
      }

      entry.value.status = "success";
      state.value.shownQuery = query.keyword;
      state.value.products = result.products;
    } catch (error) {
      if (axios.isCancel(error)) {
        entry.value.status = "canceled";
      } else {
        entry.value.status = "error";
        entry.value.message =
          error instanceof Error ? error.message : String(error);
      }
    } finally {
      entry.value.usedMs = Date.now() - startedAt;
    }
  };

  const sendToAllPanels = (query: ProductQuery) => {
    lanes.forEach((lane) => void send(lane, query));
  };

  const start = () => {
    if (running.value) return;

    lanes.forEach(({ state }) => {
      state.value = emptyPanel();
    });

    const [first, second] = requestList;
    sendToAllPanels(first);
    waitingForNext.value = true;
    setTimeout(() => {
      waitingForNext.value = false;
      sendToAllPanels(second);
    }, SEND_GAP_MS);
  };

  return { plain, requestId, guarded, running, start };
};
