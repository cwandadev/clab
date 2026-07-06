// src/routes/admin.products.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Power, 
  Search,
  X,
  Eye
} from "lucide-react";
import { listAdminProducts, deleteProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/admin/products/")({
  component: AdminProducts,
});

function AdminProducts() {
  const list = useServerFn(listAdminProducts);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => list() });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedVoltage, setSelectedVoltage] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [showInStock, setShowInStock] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Get unique categories from products
  const categories = data ? [...new Set(data.map((p: any) => p.category).filter(Boolean))] : [];
  const voltages = data ? [...new Set(data.map((p: any) => p.voltage_range).filter(Boolean))] : [];
  const types = data ? [...new Set(data.map((p: any) => p.product_type).filter(Boolean))] : [];

  const filteredProducts = (data ?? []).filter((product: any) => {
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesVoltage = selectedVoltage === "all" || product.voltage_range === selectedVoltage;
    const matchesType = selectedType === "all" || product.product_type === selectedType;
    const matchesPrice = (product.price_usd || 0) >= priceRange[0] && (product.price_usd || 0) <= priceRange[1];
    const matchesStock = !showInStock || (product.stock || 0) > 0;
    
    return matchesSearch && matchesCategory && matchesVoltage && matchesType && matchesPrice && matchesStock;
  });

  const handleToggleStatus = async (product: any) => {
    toast.success(`${product.name} ${product.active ? 'deactivated' : 'activated'}`);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-muted-foreground">Loading products...</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with Add Product Button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Products</h1>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          + Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        
        <select 
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Categories</option>
          {categories.map((cat: string) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select 
          value={selectedVoltage}
          onChange={(e) => setSelectedVoltage(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Voltages</option>
          {voltages.map((v: string) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select 
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Types</option>
          {types.map((t: string) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showInStock}
              onChange={(e) => setShowInStock(e.target.checked)}
              className="rounded border-input"
            />
            In Stock Only
          </label>
        </div>

        {(searchQuery || selectedCategory !== "all" || selectedVoltage !== "all" || selectedType !== "all" || showInStock) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSelectedVoltage("all");
              setSelectedType("all");
              setShowInStock(false);
            }}
            className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {filteredProducts.length} of {data?.length || 0} products
      </p>

      {/* Product Table */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-black/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No products found matching your filters
                </td>
              </tr>
            ) : (
              filteredProducts.map((p: any) => (
                <tr key={p.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-4">
                    {p.image_url ? (
                      <img 
                        src={p.image_url} 
                        alt={p.name}
                        className="w-12 h-12 object-cover rounded-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-secondary rounded-md flex items-center justify-center text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                    {p.slug || '—'}
                  </td>
                  <td className="px-4 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.active === false && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {p.category || '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-mono ${(p.stock || 0) < 10 ? "text-red-600" : (p.stock || 0) === 0 ? "text-red-600" : "text-green-600"}`}>
                      {p.stock ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono">
                    ${Number(p.price_usd || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-4 text-right relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === p.id ? null : p.id)}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {activeMenu === p.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setActiveMenu(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-md border border-border bg-background shadow-lg p-1">
                          <Link
                            to="/admin/products/edit/$id"
                            params={{ id: p.id }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
                            onClick={() => setActiveMenu(null)}
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                          <Link
                            to="/products/$slug"
                            params={{ slug: p.slug || p.id }}
                            target="_blank"
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors"
                            onClick={() => setActiveMenu(null)}
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                          <button
                            onClick={() => {
                              handleToggleStatus(p);
                              setActiveMenu(null);
                            }}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-secondary rounded-md transition-colors ${
                              p.active !== false ? "text-yellow-600" : "text-green-600"
                            }`}
                          >
                            <Power className="w-4 h-4" />
                            {p.active !== false ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${p.name}"? This action cannot be undone.`)) {
                                deleteMut.mutate(p.id);
                                setActiveMenu(null);
                              }
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}