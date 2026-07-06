// src/routes/admin.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { AdminSidebar } from "@/components/AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/lib/products.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: "/admin" } as never });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const [status, setStatus] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    checkAdmin()
      .then((r) => setStatus(r.isAdmin ? "admin" : "denied"))
      .catch(() => setStatus("denied"));
  }, [checkAdmin]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <p className="p-12 text-center text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-medium">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have admin permissions. Ask an existing tieflab admin to grant
            you access.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}