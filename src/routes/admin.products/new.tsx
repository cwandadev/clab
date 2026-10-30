// src/routes/admin.products.new.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { upsertProduct } from "@/lib/products.functions";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/admin/products/new")({
  component: NewProduct,
});

function NewProduct() {
  const navigate = useNavigate();
  const save = useServerFn(upsertProduct);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    category: "Components",
    price_rwf: 0,
    stock: 0,
    image_url: "",
    spec_1: "",
    spec_2: "",
    active: true,
    product_type: "physical" as "physical" | "digital_circuit",
    low_stock_threshold: 10,
    weight_grams: 0,
  });
  const [extraImagesText, setExtraImagesText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const extra_images = extraImagesText
        .split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
      await save({ data: { ...form, extra_images } });
      toast.success("Product added");
      navigate({ to: "/admin/products" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductForm
      form={form}
      setForm={setForm as any}
      extraImagesText={extraImagesText}
      setExtraImagesText={setExtraImagesText}
      onSubmit={submit}
      saving={saving}
      title="Create new product"
      submitLabel="Create product"
    />
  );
}

export function ProductForm({
  form, setForm, extraImagesText, setExtraImagesText, onSubmit, saving, title, submitLabel,
}: {
  form: any;
  setForm: (v: any) => void;
  extraImagesText: string;
  setExtraImagesText: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  title: string;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
      <h2 className="text-lg font-medium">{title}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Slug (url id)">
          <input required pattern="[a-z0-9-]+" value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })} className="inp font-mono" />
        </Field>
        <Field label="Category">
          <input required value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })} className="inp" />
        </Field>
      </div>

      <Field label="Name">
        <input required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} className="inp" />
      </Field>

      <Field label="Description">
        <textarea value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4} className="inp" />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Product type">
          <select value={form.product_type}
            onChange={(e) => setForm({ ...form, product_type: e.target.value })} className="inp">
            <option value="physical">Physical (Add to Cart)</option>
            <option value="digital_circuit">Component / Kit</option>
          </select>
        </Field>
        <Field label="Price (RWF, whole francs)">
          <input required type="number" min={0} step="1" value={form.price_rwf}
            onChange={(e) => setForm({ ...form, price_rwf: Math.round(Number(e.target.value)) })} className="inp font-mono" />
        </Field>
        <Field label="Stock">
          <input required type="number" min={0} value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="inp font-mono" />
        </Field>
        <Field label="Low-stock alert">
          <input type="number" min={0} value={form.low_stock_threshold ?? 10}
            onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} className="inp font-mono" />
        </Field>
      </div>

      <Field label="Photos">
        <ImageUploader
          urls={[form.image_url, ...extraImagesText.split("\n")].map((x: string) => (x ?? "").trim()).filter(Boolean)}
          onChange={(urls) => { setForm({ ...form, image_url: urls[0] ?? "" }); setExtraImagesText(urls.slice(1).join("\n")); }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Spec 1 (e.g. 5V)">
          <input value={form.spec_1 ?? ""}
            onChange={(e) => setForm({ ...form, spec_1: e.target.value })} className="inp" />
        </Field>
        <Field label="Spec 2 (e.g. USB-C)">
          <input value={form.spec_2 ?? ""}
            onChange={(e) => setForm({ ...form, spec_2: e.target.value })} className="inp" />
        </Field>
      </div>

      <Field label="Weight (grams, optional)">
        <input type="number" min={0} step="0.1" value={form.weight_grams ?? 0}
          onChange={(e) => setForm({ ...form, weight_grams: Number(e.target.value) })} className="inp font-mono" />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Active (visible in shop)
      </label>

      <button type="submit" disabled={saving}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {saving ? "Saving…" : submitLabel}
      </button>
      <style>{`.inp{width:100%;border:1px solid var(--input);border-radius:6px;padding:0.5rem 0.75rem;font-size:0.875rem;background:var(--background)}`}</style>
    </form>
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
