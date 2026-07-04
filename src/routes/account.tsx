import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — tieflab" }] }),
  component: AccountPage,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw redirect({ to: "/auth", search: { redirect: "/account", code: undefined, error: undefined, error_description: undefined } as never });
    }
  },
});

const accountSchema = z.object({
  first_name: z.string().max(50).optional().nullable(),
  last_name: z.string().max(50).optional().nullable(),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional().nullable(),
  phone_country_code: z.string().max(10).optional().nullable(),
  billing_address: z.string().max(200).optional().nullable(),
  billing_code: z.string().max(20).optional().nullable(),
  location_country: z.string().max(100).optional().nullable(),
  location_city: z.string().max(100).optional().nullable(),
  location_address: z.string().max(200).optional().nullable(),
  language_preference: z.string().max(10),
  theme_preference: z.enum(["light", "dark"]),
  currency_preference: z.enum(["RWF", "USD", "EUR", "GBP"]),
});

type AccountFormData = z.infer<typeof accountSchema>;

type ProfileSnapshot = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_country_code?: string | null;
  billing_address?: string | null;
  billing_code?: string | null;
  location_country?: string | null;
  location_city?: string | null;
  location_address?: string | null;
  language_preference?: string | null;
  theme_preference?: string | null;
  currency_preference?: string | null;
};

const CARRIER_URLS: Record<string, (trackingNumber: string) => string> = {
  dhl: (tn) => `https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${tn}`,
  ups: (tn) => `https://www.ups.com/track?tracknum=${tn}`,
  fedex: (tn) => `https://www.fedex.com/fedextrack/?trknbr=${tn}`,
  usps: (tn) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`,
  tnt: (tn) => `https://www.tnt.com/express/en_us/site/tracking.html?search=${tn}`,
  dpd: (tn) => `https://track.dpd.co.uk/parcel/${tn}`,
  hermes: (tn) => `https://www.myhermes.co.uk/tracking/${tn}`,
  royal_mail: (tn) => `https://www.royalmail.com/track-your-item#/tracking-result?id=${tn}`,
  gls: (tn) => `https://gls-group.eu/GROUP/en/parcel-tracking?match=${tn}`,
  default: (tn) => `https://www.google.com/search?q=track+package+${encodeURIComponent(tn)}`,
};

function getCarrierUrl(carrier?: string, trackingNumber?: string): string {
  if (!trackingNumber) return "#";
  const key = (carrier || "").toLowerCase().replace(/\s+/g, "_");
  const fn = CARRIER_URLS[key] || CARRIER_URLS.default;
  return fn(trackingNumber);
}

const TRANSLATIONS: Record<string, Record<string, string>> = {
  success: {
    en: "Profile updated successfully!",
    fr: "Profil mis à jour avec succès!",
    rw: "Umwirondoro wagiye uhindurwa neza!",
    ru: "Профиль успешно обновлен!",
    sw: "Wasifu umefanikiwa kusasishwa!",
    ja: "プロフィールが正常に更新されました！",
    zh: "个人资料更新成功！",
    ko: "프로필이 성공적으로 업데이트되었습니다!",
    es: "¡Perfil actualizado con éxito!",
    ar: "تم تحديث الملف الشخصي بنجاح!",
  },
  picture: {
    en: "Profile picture updated!",
    fr: "Photo de profil mise à jour!",
    rw: "Ifoto y'umwirondoro yagiye ihindurwa!",
    ru: "Фото профиля обновлено!",
    sw: "Picha ya wasifu imefanikiwa kusasishwa!",
    ja: "プロフィール画像が更新されました！",
    zh: "头像已更新！",
    ko: "프로필 사진이 업데이트되었습니다!",
    es: "¡Foto de perfil actualizada!",
    ar: "تم تحديث صورة الملف الشخصي!",
  },
};

function AccountPage() {
  const [userRole, setUserRole] = useState<"admin" | "user" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState<ProfileSnapshot | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderFilter, setOrderFilter] = useState<"all" | "pending" | "processing" | "shipped" | "delivered">("all");
  const [orderDateFilter, setOrderDateFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [reviewLink, setReviewLink] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const { currency, setCurrency } = useStore();

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      phone_country_code: "+1",
      billing_address: "",
      billing_code: "",
      location_country: "",
      location_city: "",
      location_address: "",
      language_preference: "en",
      theme_preference: "light",
      currency_preference: "RWF",
    },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const t = (key: "success" | "picture") => {
    const lang = initial?.language_preference || "en";
    return TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.en || "";
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Real-time subscriptions for orders and chat
  useEffect(() => {
    if (userRole !== "user" && userRole !== "admin") return;

    const ordersChannel = supabase
      .channel("orders-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (userRole === "user") loadOrders();
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel("chat-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          loadChatMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [userRole]);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const snapshot: ProfileSnapshot = {};

    if (profile) {
      snapshot.first_name = profile.first_name || "";
      snapshot.last_name = profile.last_name || "";
      snapshot.email = profile.email || "";
      snapshot.phone = profile.phone || "";
      snapshot.phone_country_code = profile.phone_country_code || "+1";
      snapshot.billing_address = profile.billing_address || "";
      snapshot.billing_code = profile.billing_code || "";
      snapshot.location_country = profile.location_country || "";
      snapshot.location_city = profile.location_city || "";
      snapshot.location_address = profile.location_address || "";
      snapshot.language_preference = profile.language_preference || "en";
      snapshot.theme_preference = profile.theme_preference || "light";
      snapshot.currency_preference = profile.currency_preference || "RWF";

      setValue("first_name", snapshot.first_name);
      setValue("last_name", snapshot.last_name);
      setValue("email", snapshot.email);
      setValue("phone", snapshot.phone);
      setValue("phone_country_code", snapshot.phone_country_code);
      setValue("billing_address", snapshot.billing_address);
      setValue("billing_code", snapshot.billing_code);
      setValue("location_country", snapshot.location_country);
      setValue("location_city", snapshot.location_city);
      setValue("location_address", snapshot.location_address);
      setValue("language_preference", snapshot.language_preference);
      setValue("theme_preference", snapshot.theme_preference as "light" | "dark");
      setValue("currency_preference", snapshot.currency_preference as "RWF" | "USD" | "EUR" | "GBP");
      setAvatarUrl(profile.avatar_url || null);
      setInitial(snapshot);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roles) {
      setUserRole(roles.role);
    }

    setLoading(false);
  }

  async function onSubmit(data: AccountFormData) {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updates: any = {
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        email: data.email,
        phone: data.phone || null,
        phone_country_code: data.phone_country_code || "+1",
        billing_address: data.billing_address || null,
        billing_code: data.billing_code || null,
        location_country: data.location_country || null,
        location_city: data.location_city || null,
        location_address: data.location_address || null,
        language_preference: data.language_preference,
        theme_preference: data.theme_preference,
        currency_preference: data.currency_preference,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      const changed =
        (initial?.first_name || "") !== (data.first_name || "") ||
        (initial?.last_name || "") !== (data.last_name || "") ||
        (initial?.phone || "") !== (data.phone || "") ||
        (initial?.phone_country_code || "+1") !== (data.phone_country_code || "+1") ||
        (initial?.billing_address || "") !== (data.billing_address || "") ||
        (initial?.billing_code || "") !== (data.billing_code || "") ||
        (initial?.location_country || "") !== (data.location_country || "") ||
        (initial?.location_city || "") !== (data.location_city || "") ||
        (initial?.location_address || "") !== (data.location_address || "") ||
        (initial?.language_preference || "en") !== data.language_preference ||
        (initial?.theme_preference || "light") !== data.theme_preference ||
        (initial?.currency_preference || "RWF") !== data.currency_preference;

      if (changed) {
        setCurrency(data.currency_preference);
        localStorage.setItem("tl_currency", data.currency_preference);
        window.dispatchEvent(new Event("storage"));

        localStorage.setItem("clab.lang", data.language_preference);
        localStorage.setItem("clab.theme", data.theme_preference);
        document.documentElement.classList.toggle("dark", data.theme_preference === "dark");
        window.dispatchEvent(new Event("storage"));

        toast.success(t("success"));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        throw new Error("Only JPEG, PNG, and WebP images are allowed");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Image must be less than 2MB");
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      toast.success(t("picture"));
    } catch (err: any) {
      toast.error(err.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (userRole === "user") {
      loadOrders();
      loadChatMessages();
      loadReviews();
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole === "admin") {
      loadChatMessages();
    }
  }, [userRole]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (orderFilter !== "all") {
        query = query.eq("status", orderFilter);
      }

      if (orderDateFilter !== "all") {
        const dateMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
        const days = dateMap[orderDateFilter];
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte("created_at", since.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadChatMessages() {
    setLoadingChat(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (userRole === "admin") {
        query = query.or(`user_id.eq.${user.id},is_from_admin.eq.true`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setChatMessages(data || []);
    } catch (err: any) {
      console.error("Failed to load chat messages:", err);
    } finally {
      setLoadingChat(false);
    }
  }

  async function sendChatMessage() {
    if (!newMessage.trim() && !attachment) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let attachmentUrl: string | undefined;

      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const filePath = `chat/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, attachment);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);
        attachmentUrl = publicUrl;
      }

      const { error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          message: newMessage.trim() || "Sent an attachment",
          is_from_admin: false,
          attachment_url: attachmentUrl,
        });

      if (error) throw error;
      setNewMessage("");
      setAttachment(null);
      loadChatMessages();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    }
  }

  async function loadReviews() {
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          profiles:user_id(first_name, last_name),
          review_responses(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err: any) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  }

  async function submitReview() {
    if (!reviewComment.trim() && !reviewPhoto && !reviewLink) return;

    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let photoUrl: string | undefined;

      if (reviewPhoto) {
        const fileExt = reviewPhoto.name.split('.').pop();
        const filePath = `reviews/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("review-photos")
          .upload(filePath, reviewPhoto);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("review-photos").getPublicUrl(filePath);
        photoUrl = publicUrl;
      }

      const { data: products } = await supabase
        .from("products")
        .select("id")
        .limit(1);

      const { error } = await supabase
        .from("reviews")
        .insert({
          user_id: user.id,
          product_id: products?.[0]?.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          photo_url: photoUrl || null,
          link_url: reviewLink || null,
        });

      if (error) throw error;

      setReviewRating(5);
      setReviewComment("");
      setReviewPhoto(null);
      setReviewLink("");
      loadReviews();
      toast.success("Review submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleVote(reviewId: string, voteType: 1 | -1) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingVote } = await supabase
        .from("review_votes")
        .select("*")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          await supabase.from("review_votes").delete().eq("id", existingVote.id);
        } else {
          await supabase.from("review_votes").update({ vote_type: voteType }).eq("id", existingVote.id);
        }
      } else {
        await supabase.from("review_votes").insert({ review_id: reviewId, user_id: user.id, vote_type: voteType });
      }

      loadReviews();
    } catch (err: any) {
      console.error("Failed to vote:", err);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "delivered": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRatingChange?.(star)}
            className={`text-lg ${star <= rating ? "text-yellow-400" : "text-gray-300"} ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-medium tracking-tight">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your profile, preferences, and orders.
        </p>

        {/* Admin Panel */}
        {userRole === "admin" && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Admin Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Access administrative tools and management panels.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin"
                className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Manage Products
              </Link>
              <Link
                to="/admin/orders"
                className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:opacity-90"
              >
                Manage Orders
              </Link>
              <Link
                to="/admin/users"
                className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:opacity-90"
              >
                View All Users
              </Link>
              <Link
                to="/admin/analytics"
                className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:opacity-90"
              >
                Analytics
              </Link>
              <Link
                to="/admin/chats"
                className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:opacity-90"
              >
                Live Chats
              </Link>
            </div>

            {/* Analytics Placeholders */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Link
                to="/admin/analytics/financial"
                className="block rounded-lg border border-border bg-background p-4 hover:border-foreground transition-colors"
              >
                <h3 className="text-sm font-medium">Financial Analytics</h3>
                <p className="text-xs text-muted-foreground mt-1">Revenue, profit, losses</p>
              </Link>
              <Link
                to="/admin/analytics/products"
                className="block rounded-lg border border-border bg-background p-4 hover:border-foreground transition-colors"
              >
                <h3 className="text-sm font-medium">Products Analytics</h3>
                <p className="text-xs text-muted-foreground mt-1">Stock, sales, inventory</p>
              </Link>
              <Link
                to="/admin/analytics/customers"
                className="block rounded-lg border border-border bg-background p-4 hover:border-foreground transition-colors"
              >
                <h3 className="text-sm font-medium">Customers Analytics</h3>
                <p className="text-xs text-muted-foreground mt-1">Locations, payments, retention</p>
              </Link>
            </div>
          </div>
        )}

        {/* Client Order Tracking */}
        {userRole === "user" && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Order Tracking</h2>
              <button
                onClick={loadOrders}
                disabled={loadingOrders}
                className="text-sm text-accent hover:underline disabled:opacity-50"
              >
                {loadingOrders ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={orderFilter}
                onChange={(e) => {
                  setOrderFilter(e.target.value as any);
                  setTimeout(loadOrders, 0);
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
              <select
                value={orderDateFilter}
                onChange={(e) => {
                  setOrderDateFilter(e.target.value as any);
                  setTimeout(loadOrders, 0);
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>

            {loadingOrders && orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet. Start shopping!</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const carrierUrl = getCarrierUrl(order.carrier, order.tracking_number);
                  return (
                    <div key={order.id} className="rounded-md border border-border bg-background p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status || "pending")}`}>
                          {order.status || "Pending"}
                        </span>
                      </div>

                      {order.tracking_number && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Tracking:</span>{" "}
                          {carrierUrl !== "#" ? (
                            <a href={carrierUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-accent hover:underline">
                              {order.tracking_number} ({order.carrier || "track"})
                            </a>
                          ) : (
                            <span className="font-mono">{order.tracking_number}</span>
                          )}
                        </div>
                      )}

                      {order.pickup_option && (
                        <div className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Self-Pickup
                        </div>
                      )}

                      {order.anonymous && (
                        <div className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Anonymous Order
                        </div>
                      )}

                      <div className="text-sm">
                        <span className="text-muted-foreground">Total:</span>{" "}
                        <span className="font-medium">{order.display_currency || "RWF"} {order.total_usd?.toFixed(2)}</span>
                      </div>

                      {order.payment_method && (
                        <div className="text-xs text-muted-foreground">
                          Paid via {order.payment_method}
                        </div>
                      )}

                      {/* Status Timeline */}
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`flex items-center gap-1 ${["pending", "processing", "shipped", "delivered"].includes(order.status || "pending") ? "text-foreground" : "text-muted-foreground"}`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                            <span>Pending</span>
                          </div>
                          <div className="flex-1 h-px bg-border" />
                          <div className={`flex items-center gap-1 ${["processing", "shipped", "delivered"].includes(order.status || "pending") ? "text-foreground" : "text-muted-foreground"}`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                            <span>Processing</span>
                          </div>
                          <div className="flex-1 h-px bg-border" />
                          <div className={`flex items-center gap-1 ${["shipped", "delivered"].includes(order.status || "pending") ? "text-foreground" : "text-muted-foreground"}`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                            <span>Shipped</span>
                          </div>
                          <div className="flex-1 h-px bg-border" />
                          <div className={`flex items-center gap-1 ${order.status === "delivered" ? "text-foreground" : "text-muted-foreground"}`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                            <span>Delivered</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Live Chat Support */}
        {(userRole === "user" || userRole === "admin") && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Live Chat Support</h2>
            <p className="text-sm text-muted-foreground">
              {userRole === "admin" ? "Respond to client messages in real time." : "Need help? Chat with our support team."}
            </p>

            <div className="h-96 flex flex-col border border-border rounded-md bg-background">
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2"
              >
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No messages yet. Start a conversation!
                  </p>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_from_admin ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 space-y-1 ${
                          msg.is_from_admin
                            ? "bg-secondary text-foreground"
                            : "bg-foreground text-background"
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        {msg.attachment_url && (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs underline break-all">
                            Attachment
                          </a>
                        )}
                        <p className="text-xs opacity-70">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder="Type your message..."
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-secondary">
                    📎
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    onClick={sendChatMessage}
                    disabled={!newMessage.trim() && !attachment}
                    className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                {attachment && (
                  <p className="text-xs text-muted-foreground mt-1">Selected: {attachment.name}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        {userRole === "user" && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Reviews</h2>
            <p className="text-sm text-muted-foreground">
              Share your experience and see what others think.
            </p>

            {/* Submit Review */}
            <div className="rounded-md border border-border bg-background p-4 space-y-3">
              <h3 className="text-sm font-medium">Write a Review</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Rating</label>
                {renderStars(reviewRating, true, setReviewRating)}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label htmlFor="review-photo" className="cursor-pointer text-sm text-accent hover:underline">
                  Add Photo (optional)
                </label>
                <input
                  id="review-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReviewPhoto(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {reviewPhoto && (
                  <span className="text-xs text-muted-foreground">{reviewPhoto.name}</span>
                )}
              </div>
              <input
                type="url"
                value={reviewLink}
                onChange={(e) => setReviewLink(e.target.value)}
                placeholder="Add a link (optional)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={submitReview}
                disabled={submittingReview || !reviewComment.trim()}
                className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium pt-2">Recent Reviews</h3>
              {loadingReviews ? (
                <p className="text-sm text-muted-foreground">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
              ) : (
                reviews.map((review) => {
                  const upvotes = (review as any).upvotes || 0;
                  const downvotes = (review as any).downvotes || 0;
                  return (
                    <div key={review.id} className="rounded-md border border-border bg-background p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {review.profiles?.first_name} {review.profiles?.last_name}
                          </p>
                          {renderStars(review.rating)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.comment && <p className="text-sm">{review.comment}</p>}
                      {review.photo_url && (
                        <img src={review.photo_url} alt="Review" className="w-32 h-32 object-cover rounded-md" />
                      )}
                      {review.link_url && (
                        <a href={review.link_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">
                          {review.link_url}
                        </a>
                      )}
                      <div className="flex gap-4 pt-2">
                        <button
                          onClick={() => handleVote(review.id, 1)}
                          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          ▲ {upvotes}
                        </button>
                        <button
                          onClick={() => handleVote(review.id, -1)}
                          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          ▼ {downvotes}
                        </button>
                      </div>
                      {review.review_responses?.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                          {review.review_responses.map((response: any) => (
                            <div key={response.id} className="text-sm">
                              <p className="font-medium">Admin Response:</p>
                              <p className="text-muted-foreground">{response.response}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Profile Picture</h2>
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="size-20 rounded-full object-cover border border-border" />
              ) : (
                <div className="size-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-medium">
                  {userRole === "admin" ? "A" : "U"}
                </div>
              )}
              <div>
                <label htmlFor="avatar-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
                  {uploading ? "Uploading…" : "Upload Picture"}
                </label>
                <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploading} className="hidden" />
                <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Personal Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldField label="First name" {...register("first_name")} error={errors.first_name?.message} />
              <FieldField label="Last name" {...register("last_name")} error={errors.last_name?.message} />
            </div>
            <FieldField label="Email" type="email" {...register("email")} error={errors.email?.message} readOnly />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <div className="flex gap-2">
                  <select {...register("phone_country_code")} className="w-24 rounded-md border border-input bg-background px-2 py-2 text-sm">
                    <option value="+1">US +1</option>
                    <option value="+44">UK +44</option>
                    <option value="+250">Rwanda +250</option>
                    <option value="+254">Kenya +254</option>
                    <option value="+27">South Africa +27</option>
                    <option value="+234">Nigeria +234</option>
                    <option value="+91">India +91</option>
                  </select>
                  <input type="tel" {...register("phone")} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="788 123 456" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Preferences</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <select {...register("language_preference")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="rw">Kinyarwanda</option>
                  <option value="ru">Русский</option>
                  <option value="sw">Kiswahili</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                  <option value="ko">한국어</option>
                  <option value="es">Español</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Theme</label>
                <select {...register("theme_preference")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Location</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldField label="Country" {...register("location_country")} error={errors.location_country?.message} />
              <FieldField label="City" {...register("location_city")} error={errors.location_city?.message} />
            </div>
            <FieldField label="Address" {...register("location_address")} error={errors.location_address?.message} />
            <FieldField label="Billing Code" {...register("billing_code")} error={errors.billing_code?.message} />
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Billing & Financial</h2>
            <FieldField label="Billing Address" {...register("billing_address")} error={errors.billing_address?.message} />
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select {...register("currency_preference")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {userRole === "admin" && (
              <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                Admin
              </span>
            )}
          </div>

          {/* Checkout Options Information */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Checkout Options</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-medium">Self-Pickup</h3>
                <p className="text-xs text-muted-foreground">
                  Choose self-pickup at checkout to skip delivery. No address needed—just show your order confirmation at pickup.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-medium">Anonymous Checkout</h3>
                <p className="text-xs text-muted-foreground">
                  Complete your purchase without creating an account. Provide only the necessary payment details—no personal information required.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-medium">Cash Payment</h3>
                <p className="text-xs text-muted-foreground">
                  Pay with cash upon delivery or pickup. Simple and convenient.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-medium">Card & Stripe</h3>
                <p className="text-xs text-muted-foreground">
                  Pay securely using credit/debit cards via Stripe.
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-medium">WhatsApp Order</h3>
                <p className="text-xs text-muted-foreground">
                  Place orders directly through WhatsApp for personalized assistance.
                </p>
              </div>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}

function FieldField({ label, error, readOnly, type = "text", ...props }: { label: string; error?: string; readOnly?: boolean; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        readOnly={readOnly}
        {...props}
        className={
          "w-full rounded-md border px-3 py-2 text-sm bg-background " +
          (error ? "border-red-500" : "border-input") +
          (readOnly ? " opacity-60 cursor-not-allowed" : "")
        }
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}