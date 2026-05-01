"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Category } from "@/lib/types";

const COLOR_OPTIONS = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#71717a",
];

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    await supabase
      .from("categories")
      .insert({ name: name.trim(), icon, color });

    setName("");
    setIcon("📦");
    setLoading(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category? Transactions will become uncategorized.")) return;
    await supabase.from("categories").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-4 rounded-xl border border-surface-3 bg-surface-1 p-5"
      >
        <div>
          <label className="mb-1.5 block text-xs text-muted">Icon</label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-16 rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-center text-lg"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-xs text-muted">Name</label>
          <input
            type="text"
            required
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted">Color</label>
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  color === c
                    ? "scale-110 border-white"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Category list */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between rounded-xl border border-surface-3 bg-surface-1 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                {cat.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{cat.name}</p>
                <div
                  className="mt-1 h-1 w-8 rounded-full"
                  style={{ backgroundColor: cat.color ?? "#71717a" }}
                />
              </div>
            </div>
            <button
              onClick={() => handleDelete(cat.id)}
              className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
