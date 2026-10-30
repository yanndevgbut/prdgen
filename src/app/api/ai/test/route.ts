import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { test9routerConnection } from "@/lib/ai/9router";
import { validateSafePublicUrl } from "@/lib/security/ssrf";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const { baseUrl, apiKey, model } = body;

    if (baseUrl) {
      const urlValidation = validateSafePublicUrl(baseUrl);
      if (!urlValidation.valid) {
        return NextResponse.json(
          { success: false, latencyMs: 0, responseMessage: `SSRF Guard: ${urlValidation.error}` },
          { status: 400 }
        );
      }
    }

    const result = await test9routerConnection({
      baseUrl,
      apiKey,
      model,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, latencyMs: 0, responseMessage: err.message || "Gagal tes koneksi" },
      { status: 500 }
    );
  }
}
