import type { AxiosInstance, AxiosRequestConfig } from "axios";

export type Product = { id: number; title: string; price: number };
export type ProductQuery = { keyword: string; delay: number };
export type ProductSearch = ProductQuery & { panel: string };
export type ProductSearchResult = { products: Product[]; total: number };

export const searchProducts = async (
  client: AxiosInstance,
  { keyword, delay, panel }: ProductSearch,
  config?: AxiosRequestConfig,
): Promise<ProductSearchResult> => {
  const response = await client.get<ProductSearchResult>("/products/search", {
    ...config,
    // DummyJSON 會忽略 panel，它只讓各面板的 URL 不同，避免瀏覽器把相同 URL 排隊
    params: { q: keyword, delay, panel, limit: 3, select: "title,price" },
  });

  return response.data;
};
