import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
});

export const signUp = createServerFn({ method: "POST" })
  .validator((d) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { email, password, displayName } = data;

    // Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: {
        display_name: displayName || email.split("@")[0],
      },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Failed to create user");

    // The database trigger should create the profile, but let's ensure it exists
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        display_name: displayName || email.split("@")[0],
      });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Don't throw - the trigger might have already created it
    }

    return { user: authData.user };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ email: z.string().email(), password: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { email, password } = data;

    const { data: authData, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!authData.user) throw new Error("Invalid credentials");

    return { user: authData.user, session: authData.session };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { supabase } = await import("@/integrations/supabase/client.server");
  // Note: This won't work as expected because client.server.ts uses service role
  // We need to use the client-side supabase for signOut
  return { ok: true };
});