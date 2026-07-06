// src/routes/admin.tutorials.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Edit, Trash2, Search, Video, Code, FileText, Link2, X } from "lucide-react";

export const Route = createFileRoute("/admin/tutorials")({
  component: AdminTutorials,
});

function AdminTutorials() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "video" | "code" | "documentation">("all");

  // Mock data - replace with your actual data
  const tutorials = [
    { id: "1", title: "Getting Started with Arduino", type: "video", url: "https://youtube.com/..." },
    { id: "2", title: "Python for Beginners", type: "code", url: "https://github.com/..." },
    { id: "3", title: "PCB Design Guide", type: "documentation", url: "https://docs.xyz/..." },
  ];

  const filteredTutorials = tutorials.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeTab === "all" || t.type === activeTab;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-4 h-4" />;
      case "code": return <Code className="w-4 h-4" />;
      case "documentation": return <FileText className="w-4 h-4" />;
      default: return <Link2 className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Tutorials</h1>
        <button className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          Add Tutorial
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tutorials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-1 bg-secondary rounded-md p-1">
          {["all", "video", "code", "documentation"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTab === tab 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTutorials.map((tutorial) => (
          <div key={tutorial.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-secondary rounded-lg">
                  {getTypeIcon(tutorial.type)}
                </span>
                <div>
                  <h3 className="font-medium">{tutorial.title}</h3>
                  <span className="text-xs text-muted-foreground capitalize">{tutorial.type}</span>
                </div>
              </div>
            </div>
            <a 
              href={tutorial.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline truncate block"
            >
              {tutorial.url}
            </a>
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