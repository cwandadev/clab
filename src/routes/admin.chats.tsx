import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/admin/chats")({
  head: () => ({ meta: [{ title: "Live Chats — Admin — tieflab" }] }),
  component: AdminChatsPage,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: "/admin/chats" } as never });
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

export default function AdminChatsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-2xl font-medium tracking-tight">Live Chats</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Active client conversations and admin responses.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <div className="h-64 flex items-center justify-center border border-border rounded-md">
            <span className="text-sm text-muted-foreground">Chat dashboard coming soon</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}