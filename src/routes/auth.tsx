import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — tieflab" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
    code: typeof s.code === "string" ? s.code : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
    error_description: typeof s.error_description === "string" ? s.error_description : undefined,
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Method = "email" | "phone";

function AuthPage() {
  const { redirect, code, error, error_description } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [method, setMethod] = useState<Method>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      const errorMessage = error_description || error;
      toast.error(decodeURIComponent(errorMessage));
      navigate({ to: "/auth", search: { redirect, code: undefined, error: undefined, error_description: undefined }, replace: true });
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast.error("Authentication failed. Please try again.");
          console.error("OAuth error:", error);
        } else {
          toast.success("Signed in successfully!");
        }
        navigate({ to: redirect as never, replace: true });
      });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/account", replace: true });
      }
    });
  }, [navigate, redirect, code, error, error_description]);

  async function applyUserPreferences() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("language_preference, theme_preference, currency_preference")
        .eq("id", user.id)
        .single();
      if (profile) {
        if (profile.language_preference && profile.language_preference !== "en") {
          localStorage.setItem("clab.lang", profile.language_preference);
        }
        if (profile.currency_preference) {
          localStorage.setItem("tl_currency", profile.currency_preference);
          window.dispatchEvent(new Event("storage"));
        }
        if (profile.theme_preference) {
          localStorage.setItem("clab.theme", profile.theme_preference);
          document.documentElement.classList.toggle("dark", profile.theme_preference === "dark");
        }
      }
    } catch (error) {
      console.error("Failed to apply user preferences:", error);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! Please check your email to verify your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in successfully!");
      }
      await applyUserPreferences();
      navigate({ to: redirect as never, replace: true });
    } catch (err: any) {
      const errorMessage = err.message || "Authentication failed";
      if (errorMessage.includes("Invalid login credentials")) {
        toast.error("Invalid email or password. Please try again.");
      } else if (errorMessage.includes("Email not confirmed")) {
        toast.error("Please verify your email before signing in.");
      } else if (errorMessage.includes("User already registered")) {
        toast.error("An account with this email already exists. Please sign in instead.");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${phone}`;
      if (!fullPhoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
        throw new Error("Please enter a valid phone number with country code");
      }
      const { error } = await supabase.auth.signInWithOtp({ 
        phone: fullPhoneNumber,
        options: { shouldCreateUser: true }
      });
      if (error) {
        if (error.message.includes("Unsupported") || error.message.includes("not enabled")) {
          throw new Error("Phone authentication is not available. Please use email or Google sign-in.");
        } else if (error.message.includes("rate limit")) {
          throw new Error("Too many attempts. Please wait a moment and try again.");
        }
        throw error;
      }
      setOtpSent(true);
      toast.success("Verification code sent! Please check your phone.");
    } catch (err: any) {
      toast.error(err.message || "Could not send verification code");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fullPhoneNumber = `${countryCode}${phone}`;
      if (!otpCode || otpCode.length < 4) {
        throw new Error("Please enter the complete verification code");
      }
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otpCode,
        type: "sms",
      });
      if (error) {
        if (error.message.includes("Invalid") || error.message.includes("expired")) {
          throw new Error("Invalid or expired code. Please try again or request a new code.");
        }
        throw error;
      }
      toast.success("Signed in successfully!");
      await applyUserPreferences();
      navigate({ to: redirect as never, replace: true });
    } catch (err: any) {
      toast.error(err.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth?redirect=${encodeURIComponent(redirect)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { 
          redirectTo,
          queryParams: { access_type: 'offline', prompt: 'consent' }
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-medium tracking-tight">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome to tieflab. Sign in with Google, email, or phone.
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-input bg-background py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-1 rounded-md bg-secondary p-0.5">
          <button onClick={() => setMethod("email")} className={"flex-1 rounded px-3 py-1.5 text-xs font-medium " + (method === "email" ? "bg-background shadow-sm" : "text-muted-foreground")}>Email</button>
          <button onClick={() => setMethod("phone")} className={"flex-1 rounded px-3 py-1.5 text-xs font-medium " + (method === "phone" ? "bg-background shadow-sm" : "text-muted-foreground")}>Phone</button>
        </div>

        {method === "email" ? (
          <form onSubmit={handleEmail} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Display name">
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" />
            </Field>
            <Field label="Password">
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input-base" />
            </Field>
            <button type="submit" disabled={loading} className="w-full rounded-md bg-foreground py-3 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        ) : !otpSent ? (
          <form onSubmit={handlePhoneSend} className="mt-6 space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <Field label="Country">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="input-base">
                  <option value="+1">US +1</option>
                  <option value="+44">UK +44</option>
                  <option value="+250">Rwanda +250</option>
                  <option value="+254">Kenya +254</option>
                  <option value="+27">South Africa +27</option>
                  <option value="+234">Nigeria +234</option>
                  <option value="+91">India +91</option>
                </select>
              </Field>
              <Field label="Phone number">
                <input type="tel" required placeholder="788 123 456" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 15))} className="input-base" />
              </Field>
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-md bg-foreground py-3 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneVerify} className="mt-6 space-y-4">
            <Field label={`Verification code for ${countryCode}${phone}`}>
              <input required value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]*" className="input-base tracking-[0.4em] text-center" />
            </Field>
            <button type="submit" disabled={loading} className="w-full rounded-md bg-foreground py-3 text-sm font-medium text-background disabled:opacity-50">
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); }} className="w-full text-xs text-muted-foreground underline">
              Use a different number
            </button>
          </form>
        )}

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-6 text-sm text-muted-foreground hover:text-foreground underline">
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </main>
      <Footer />
      <style>{`.input-base{width:100%;border:1px solid var(--input);border-radius:6px;padding:0.5rem 0.75rem;font-size:0.875rem;background:var(--background)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}