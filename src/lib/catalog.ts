import { queryOptions } from "@tanstack/react-query";
import { listProducts } from "./products.functions";

/** One shared query for the catalogue: the shop grid and the search sheet read the same cache. */
export const productsQO = queryOptions({
  queryKey: ["products"],
  queryFn: () => listProducts(),
  staleTime: 60_000,
});

export type CatalogProduct = Awaited<ReturnType<typeof listProducts>>[number];
