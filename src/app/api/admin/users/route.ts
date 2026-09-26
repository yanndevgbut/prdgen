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

  const { data: users, error } = await auth.adminClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: users || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, status, plan, role } = await req.json();
  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  const updateData: any = { updated_at: new Date().toISOString() };
  if (status) updateData.status = status;
  if (plan) updateData.plan = plan;
  if (role) updateData.role = role;

  const { data: updated, error } = await auth.adminClient
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auth.adminClient.from("activity_logs").insert({
    user_id: auth.userId,
    action: "UPDATE_USER",
    details: { target_user_id: id, changes: updateData },
  });

  return NextResponse.json({ success: true, user: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

  // Delete from auth.users (cascades to profiles & prds)
  const { error } = await auth.adminClient.auth.admin.deleteUser(id);

  if (error) {
    // If not in auth.users or fallback, delete from public.profiles
    await auth.adminClient.from("profiles").delete().eq("id", id);
  }

  await auth.adminClient.from("activity_logs").insert({
    user_id: auth.userId,
    action: "DELETE_USER",
    details: { target_user_id: id },
  });

  return NextResponse.json({ success: true });
}
