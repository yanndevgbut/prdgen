import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDynamicPakasirConfig } from "@/lib/payment/pakasir";

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

    const body = await req.json().catch(() => ({}));
    const config = await getDynamicPakasirConfig();

    if (!config.slug || !config.apiKey) {
      return NextResponse.json(
        { ok: false, message: "Slug dan API Key belum diisi." },
        { status: 400 }
      );
    }

    // Lakukan panggilan ringan ke endpoint transaksi Pakasir dengan ID dummy.
    // Autentikasi valid bila server membalas 404 (transaksi tidak ditemukan),
    // sedangkan 401/403 menandakan kredensial salah.
    const endpoint = `${config.baseUrl.replace(/\/$/, "")}/api/v2/transaction-status/${encodeURIComponent(
      config.slug
    )}/__koneksi_test__`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { "X-Api-Key": config.apiKey },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        {
          ok: false,
          message: "Kredensial ditolak (HTTP " + response.status + "). Periksa Slug & API Key.",
        },
        { status: 200 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json({
        ok: true,
        message: "Koneksi berhasil: Slug & API Key valid (Pakasir merespons dengan benar).",
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Pakasir merespons HTTP ${response.status}. Kredensial tampak valid.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Gagal menghubungi server Pakasir: " + (err?.message || "cek Base URL") },
      { status: 200 }
    );
  }
}
