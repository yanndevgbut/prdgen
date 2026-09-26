import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return { error: "Unauthorized", status: 401 };

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Forbidden", status: 403 };

  return { adminClient, userId: session.user.id };
}

export async function GET() {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: discounts, error } = await auth.adminClient
    .from("discount_coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ discounts: discounts || [] });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { code, percentage, maxUses } = body;
    const { data: newCoupon, error } = await auth.adminClient
      .from("discount_coupons")
      .insert({
        code: code.trim().toUpperCase(),
        percentage: Number(percentage),
        max_uses: Number(maxUses) || 100,
        current_uses: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, discount: newCoupon });
  }

  if (action === "toggle_active") {
    const { id, is_active } = body;
    const { data: updated, error } = await auth.adminClient
      .from("discount_coupons")
      .update({ is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, discount: updated });
  }

  if (action === "delete") {
    const { id } = body;
    const { error } = await auth.adminClient.from("discount_coupons").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
