import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
// import { Header } from "@/components/Header";
// import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin — tieflab" }] }),
  component: AdminAnalyticsPage,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: "/admin/analytics" } as never });
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (role?.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
});

type AnalyticsTab = "financial" | "products" | "customers";

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>("financial");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* <Header /> */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-2xl font-medium tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Advanced analytics in black and white, minimalist design.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setTab("financial")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "financial" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}
          >
            Financial
          </button>
          <button
            onClick={() => setTab("products")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "products" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}
          >
            Products
          </button>
          <button
            onClick={() => setTab("customers")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "customers" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}
          >
            Customers
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          {tab === "financial" && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Financial Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Revenue, profit, losses and trends.
              </p>
              <div className="h-64 flex items-center justify-center border border-border rounded-md">
                <span className="text-sm text-muted-foreground">Financial charts coming soon</span>
              </div>
            </div>
          )}

          {tab === "products" && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Products Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Total products, stock levels, and sales trends.
              </p>
              <div className="h-64 flex items-center justify-center border border-border rounded-md">
                <span className="text-sm text-muted-foreground">Product analytics coming soon</span>
              </div>
            </div>
          )}

          {tab === "customers" && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Customers Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Locations, payment methods, and returning customers.
              </p>
              <div className="h-64 flex items-center justify-center border border-border rounded-md">
                <span className="text-sm text-muted-foreground">Customer analytics coming soon</span>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
}