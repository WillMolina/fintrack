import { createServerSupabase } from "@/lib/supabase-server";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const supabase = await createServerSupabase();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <p className="mt-1 text-sm text-muted">
        Organize your transactions
      </p>
      <div className="mt-6">
        <CategoryManager categories={categories ?? []} />
      </div>
    </div>
  );
}
