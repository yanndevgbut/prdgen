import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shareSchema = z.object({
  isPublic: z.boolean(),
});

interface Params {
  params: {
    id: string;
  };
}

async function getOwnedPrd(prdId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prds")
    .select("id, is_public")
    .eq("id", prdId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!uuidRegex.test(params.id)) {
      return NextResponse.json({ error: "ID PRD tidak valid." }, { status: 400 });
    }

    const prd = await getOwnedPrd(params.id, user.id);
    if (!prd) {
      return NextResponse.json({ error: "PRD tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ isPublic: prd.is_public === true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Gagal memuat status berbagi PRD." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!uuidRegex.test(params.id)) {
      return NextResponse.json({ error: "ID PRD tidak valid." }, { status: 400 });
    }

    const rateLimit = await checkRateLimit(user.id, "prd_share_toggle", 20, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak perubahan. Coba lagi dalam ${rateLimit.resetSeconds} detik.` },
        { status: 429 }
      );
    }

    const parsed = shareSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const prd = await getOwnedPrd(params.id, user.id);
    if (!prd) {
      return NextResponse.json({ error: "PRD tidak ditemukan." }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("prds")
      .update({ is_public: parsed.data.isPublic, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id, is_public")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Gagal mengubah status berbagi PRD." },
        { status: 500 }
      );
    }

    return NextResponse.json({ isPublic: updated.is_public === true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Gagal mengubah status berbagi PRD." },
      { status: 500 }
    );
  }
}
