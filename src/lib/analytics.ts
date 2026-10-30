import { supabase } from "@/integrations/supabase/client";

export type Overview = {
  today: { orders: number; revenue: number };
  action: { to_dispatch: number; processing: number; awaiting_payment: number; refunds_pending: number; chats_waiting: number; low_stock: number; out_of_stock: number };
  period: { days: number; revenue: number; paid_orders: number; customers: number; avg_order: number };
  daily: { day: string; orders: number; revenue: number }[];
  top_products: { name: string; units: number; revenue: number }[];
  status_counts: Record<string, number>;
};

/** Every number is computed in the database (analytics_overview); screens only draw them. */
export async function fetchOverview(days: number): Promise<Overview> {
  const { data, error } = await supabase.rpc("analytics_overview", { _days: days });
  if (error) throw error;
  return data as unknown as Overview;
}
