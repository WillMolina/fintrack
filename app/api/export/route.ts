import { NextRequest, NextResponse } from "next/server";
import { format, subMonths, startOfMonth } from "date-fns";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  buildFinancialExport,
  earliestTransactionDate,
  renderExportMarkdown,
} from "@/lib/export";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=md|json
 *
 * Downloads all financial data in the period, grouped by category,
 * ready to hand to an LLM agent for analysis.
 * `from=all` starts at the earliest transaction. Defaults: last 12 months, md.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const to = DATE_RE.test(sp.get("to") ?? "") ? sp.get("to")! : today;

  let from = sp.get("from") ?? "";
  if (from === "all") {
    from = (await earliestTransactionDate(supabase)) ?? to;
  } else if (!DATE_RE.test(from)) {
    from = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  }
  if (from > to) {
    return NextResponse.json({ error: "'from' must be before 'to'" }, { status: 400 });
  }

  try {
    const data = await buildFinancialExport(supabase, from, to);
    const filename = `fintrack-${from}_${to}`;

    if (sp.get("format") === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    return new NextResponse(renderExportMarkdown(data), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
