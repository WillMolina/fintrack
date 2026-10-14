import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectNewAlerts } from "@/lib/alerts";
import { fetchActiveRules, findRuleCategory } from "@/lib/category-rules";

// Service role key bypasses RLS for server-side webhook inserts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/webhook
 *
 * Accepts transaction data from Make.com (or any external source).
 *
 * Expected JSON body:
 * {
 *   "amount": 42.99,
 *   "description": "Amazon Purchase",
 *   "merchant": "Amazon",
 *   "date": "2026-04-29",        // optional, defaults to today
 *   "category": "Subscriptions",  // optional, matched by name
 *   "account": "Chase Sapphire",  // optional, matched by name
 *   "notes": "Monthly subscription"
 * }
 *
 * If no category is sent (or it doesn't match one), the category rules
 * (/rules) fill it from description/merchant; otherwise it stays empty.
 *
 * NOTE: If the resolved account is a credit card, the database will
 * auto-assign the correct billing cycle based on the date.
 *
 * Response includes `alerts`: spending alerts that this transaction pushed
 * past their warning threshold or monthly cap (each level is reported once
 * per month). Route it in Make.com to WhatsApp/email/Telegram, e.g. using
 * each alert's `message`.
 *
 * Headers:
 *   x-webhook-secret: <your WEBHOOK_SECRET>
 */
export async function POST(request: NextRequest) {
  // 1. Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const {
      amount,
      description,
      merchant,
      date,
      category,
      account,
      notes,
    } = body;

    if (!amount || !description) {
      return NextResponse.json(
        { error: "amount and description are required" },
        { status: 400 }
      );
    }

    // 2. Resolve category by name (optional)
    let category_id: string | null = null;
    if (category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", `%${category}%`)
        .limit(1)
        .single();
      category_id = cat?.id ?? null;
    }

    // 2b. Fall back to category rules; unrecognized stays uncategorized
    if (!category_id) {
      try {
        const rules = await fetchActiveRules(supabase);
        category_id = findRuleCategory(rules, description, merchant || null)?.category_id ?? null;
      } catch (e) {
        console.error("Category rules lookup failed", e);
      }
    }

    // 3. Resolve account by name (optional)
    let account_id: string | null = null;
    if (account) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("id")
        .ilike("name", `%${account}%`)
        .limit(1)
        .single();
      account_id = acc?.id ?? null;
    }

    // 4. Insert the transaction
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        amount: Math.abs(parseFloat(String(amount).replace(/,/g, ""))),
        description,
        merchant: merchant || null,
        date: date || new Date().toISOString().split("T")[0],
        category_id,
        account_id,
        notes: notes || null,
        source: "webhook",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. Spending alerts — never fail the insert because of them
    let alerts: Awaited<ReturnType<typeof collectNewAlerts>> = [];
    try {
      alerts = await collectNewAlerts(supabase, data);
    } catch (e) {
      console.error("Spending alerts check failed", e);
    }

    return NextResponse.json({ success: true, transaction: data, alerts });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
