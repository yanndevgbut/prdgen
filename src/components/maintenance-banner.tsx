"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState<{
    enabled: boolean;
    message: string;
    eta?: string;
  } | null>(null);

  useEffect(() => {
    async function checkMaintenance() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .single();

        if (data?.value && (data.value as any).enabled) {
          setMaintenance(data.value as any);
        }
      } catch (err) {
        // Silent fail
      }
    }

    checkMaintenance();
  }, []);

  if (!maintenance || !maintenance.enabled) return null;

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs text-center">
      <span className="font-semibold">Mode Pemeliharaan Aktif:</span>{" "}
      {maintenance.message || "Sistem sedang dalam peningkatan."}
      {maintenance.eta && (
        <span className="text-amber-300 ml-1">
          (Estimasi selesai: {maintenance.eta})
        </span>
      )}
    </div>
  );
}
