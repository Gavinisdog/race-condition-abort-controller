import axios, { AxiosError } from "axios";
import { track } from "./abortManager";

declare module "axios" {
  export interface AxiosRequestConfig {
    isDebug?: boolean;
  }
}

const instance = axios.create({ baseURL: "https://httpbin.org/delay/" });

instance.interceptors.request.use(
  (config) => {
    if (!config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;
      const method = config.method;
      const path = config.url?.split("?")[0];
      track(controller, `${method} ${path}`);
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
    if (response.status !== 200) {
      console.warn(
        `[API] non-200 success: ${response.status} ${response.config.url}`,
      );
    }

    return response;
  },
  async (error: AxiosError<{ response: unknown }>) => {
    if (error.name === "CanceledError") {
      console.warn(`Request cancelled: ${error.message}`);
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
