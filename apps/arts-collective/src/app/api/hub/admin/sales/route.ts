import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";
import { exportSales, parseSalesFilters, salesCsv } from "@/lib/admin-sales";

/**
 * CSV of the filtered sales set (read-only). Same filters as /hub/admin/sales,
 * as URL params. Network admins only, checked from the session on every call;
 * never cached (it carries buyer emails).
 */
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401, headers: HEADERS });
  if (!(await isAdmin(user.id))) return new Response("Not found", { status: 404, headers: HEADERS });

  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { rows, truncated } = await exportSales(parseSalesFilters(sp));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(salesCsv(rows), {
    status: 200,
    headers: {
      ...HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-${stamp}.csv"`,
      "X-Rows-Truncated": truncated ? "yes" : "no",
    },
  });
}
