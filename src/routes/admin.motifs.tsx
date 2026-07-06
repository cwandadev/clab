// src/routes/admin.motifs.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Edit, Trash2, Search, X } from "lucide-react";

export const Route = createFileRoute("/admin/motifs")({
  component: AdminMotifs,
});

function AdminMotifs() {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data - replace with your actual data
  const motifs = [
    { id: "1", name: "Acrylic Table Lamp", category: "Lighting", price: 45.00, stock: 12, image: "" },
    { id: "2", name: "Luxury Ceiling Chandelier", category: "Lighting", price: 299.00, stock: 5, image: "" },
    { id: "3", name: "Wall Art LED Panel", category: "Wall Decor", price: 89.00, stock: 8, image: "" },
  ];

  const filteredMotifs = motifs.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Motifs</h1>
        <button className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Add Motif
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search motifs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMotifs.map((motif) => (
          <div key={motif.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="aspect-square w-full bg-secondary rounded-lg flex items-center justify-center text-muted-foreground">
              {motif.image ? (
                <img src={motif.image} alt={motif.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <span className="text-sm">No image</span>
              )}
            </div>
            <div>
              <h3 className="font-medium">{motif.name}</h3>
              <p className="text-sm text-muted-foreground">{motif.category}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono">${motif.price.toFixed(2)}</span>
              <span className={`text-xs ${motif.stock > 0 ? "text-green-600" : "text-red-600"}`}>
                Stock: {motif.stock}
              </span>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-secondary transition-colors">
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}