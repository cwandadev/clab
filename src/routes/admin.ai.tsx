// src/routes/admin.ai.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/ai")({
  component: AdminAI,
});

function AdminAI() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      // Call your AI API here
      // const result = await fetch('/api/ai', { method: 'POST', body: JSON.stringify({ prompt }) });
      // const data = await result.json();
      
      // Mock response
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResponse(`Here's a helpful response to: "${prompt}"\n\nYou can use this to generate product descriptions, tutorial content, or answer customer questions.`);
    } catch (error) {
      console.error("AI error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-accent" />
        <h1 className="text-xl font-medium">AI Assistant</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Get AI-powered help with product descriptions, tutorials, and customer support.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask me anything about your products, tutorials, or customers..."
            className="flex-1 rounded-md border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </form>

      {response && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-2">
          <h3 className="text-sm font-medium">Response</h3>
          <div className="prose prose-sm max-w-none">
            {response.split('\n').map((line, i) => (
              <p key={i} className="text-sm text-muted-foreground">{line || ' '}</p>
            ))}
          </div>
          <div className="flex gap-2 pt-3 border-t border-border">
            <button className="text-xs text-muted-foreground hover:text-foreground">Copy</button>
            <span className="text-xs text-muted-foreground">·</span>
            <button className="text-xs text-muted-foreground hover:text-foreground">Regenerate</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium">Product Descriptions</h4>
          <p className="text-xs text-muted-foreground">Generate compelling product descriptions</p>
          <button className="mt-2 text-xs text-accent hover:underline">Try example</button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium">Tutorial Content</h4>
          <p className="text-xs text-muted-foreground">Create step-by-step guides</p>
          <button className="mt-2 text-xs text-accent hover:underline">Try example</button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium">Customer Support</h4>
          <p className="text-xs text-muted-foreground">Get help with customer queries</p>
          <button className="mt-2 text-xs text-accent hover:underline">Try example</button>
        </div>
      </div>
    </div>
  );
}