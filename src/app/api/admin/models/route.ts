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

  const { data: models, error } = await auth.adminClient
    .from("ai_models")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ models: models || [] });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    const { name, modelId, provider, minTier } = body;
    const { data: newModel, error } = await auth.adminClient
      .from("ai_models")
      .insert({
        name,
        model_id: modelId,
        provider: provider || "9router",
        min_tier: minTier || "basic",
        is_default: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, model: newModel });
  }

  if (action === "set_default") {
    const { id } = body;
    await auth.adminClient.from("ai_models").update({ is_default: false }).neq("id", id);
    const { data: updated, error } = await auth.adminClient
      .from("ai_models")
      .update({ is_default: true, is_active: true })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, model: updated });
  }

  if (action === "toggle_active") {
    const { id, is_active } = body;
    const { data: updated, error } = await auth.adminClient
      .from("ai_models")
      .update({ is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, model: updated });
  }

  if (action === "delete") {
    const { id } = body;
    const { error } = await auth.adminClient.from("ai_models").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
