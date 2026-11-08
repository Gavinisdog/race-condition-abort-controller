import axios, { AxiosError } from "axios";
import { abortKey, track, untrack } from "./abortManager";

declare module "axios" {
  export interface AxiosRequestConfig {
    isDebug?: boolean;
    cancelPrevious?: boolean;
    abortController?: AbortController;
  }
}

const baseURL = "https://dummyjson.com";

const instance = axios.create({ baseURL });

// 沒處理用
export const plainClient = axios.create({ baseURL });

instance.interceptors.request.use(
  (config) => {
    if (!config.signal) {
      const method = config.method;
      const path = config.url?.split("?")[0];
      const key = `${method} ${path}`;
      if (config.cancelPrevious) abortKey(key);

      const controller = new AbortController();
      config.signal = controller.signal;
      config.abortController = controller;
      track(controller, key);
    }

    return config;
  },
  (error: unknown) => {
    console.error(error);
    return Promise.reject(
      error instanceof Error ? error : new Error(String(error)),
    );
  },
);

instance.interceptors.response.use(
  (response) => {
    if (response.config.abortController) {
      untrack(response.config.abortController);
    }

    if (response.status !== 200) {
      console.warn(
        `[API] non-200 success: ${response.status} ${response.config.url}`,
      );
    }

    return response;
  },
  async (error: AxiosError<{ response: unknown }>) => {
    if (error.config?.abortController) {
      untrack(error.config.abortController);
    }

    if (error.name === "CanceledError") {
      console.warn(`[Request cancelled] ${error}`);
    }

    if (axios.isCancel(error)) {
      if (error.config?.isDebug) {
        console.warn(`Debugging: ${error}`);
      }

      return Promise.reject(error);
    }

    console.error(error);
    return Promise.reject(error);
  },
);

export default instance;
