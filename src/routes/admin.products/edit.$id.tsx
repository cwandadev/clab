// src/routes/admin.products.edit.$id.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { upsertProduct, listAdminProducts, getProductImages } from "@/lib/products.functions";
import { ProductForm } from "./new";

export const Route = createFileRoute("/admin/products/edit/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const save = useServerFn(upsertProduct);
  const list = useServerFn(listAdminProducts);
  const imgs = useServerFn(getProductImages);
  const [form, setForm] = useState<any | null>(null);
  const [extraImagesText, setExtraImagesText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([list(), imgs({ data: { product_id: id } })]).then(([products, images]) => {
      const p = products.find((x: any) => x.id === id);
      if (p) {
        setForm({
          ...p,
          image_url: p.image_url || "",
          description: p.description || "",
          product_type: p.product_type || "physical",
          low_stock_threshold: p.low_stock_threshold ?? 10,
          weight_grams: p.weight_grams ?? 0,
        });
        setExtraImagesText((images as string[]).join("\n"));
      }
    });
  }, [id, list, imgs]);

  if (!form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const extra_images = extraImagesText
        .split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
      await save({
        data: {
          id: form.id,
          slug: form.slug,
          name: form.name,
          description: form.description,
          category: form.category,
          price_usd: Number(form.price_usd),
          stock: Number(form.stock),
          image_url: form.image_url,
          spec_1: form.spec_1 || "",
          spec_2: form.spec_2 || "",
          active: form.active,
          product_type: form.product_type,
          low_stock_threshold: Number(form.low_stock_threshold ?? 10),
          weight_grams: Number(form.weight_grams ?? 0),
          extra_images,
        },
      });
      toast.success("Product updated");
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
      setForm={setForm}
      extraImagesText={extraImagesText}
      setExtraImagesText={setExtraImagesText}
      onSubmit={submit}
      saving={saving}
      title={`Edit: ${form.name}`}
      submitLabel="Save changes"
    />
  );
}