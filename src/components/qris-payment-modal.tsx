"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { formatRupiah } from "@/lib/utils";

export interface QRISTransactionData {
  orderId: string;
  txnId: string;
  plan: string;
  billingCycle: string;
  customerEmail: string;
  customerPhone: string;
  baseAmount: number;
  discountAmount: number;
  couponCode?: string | null;
  amount: number;
  fee: number;
  totalPayment: number;
  qrString: string;
  expiredAt: string;
  isSandbox?: boolean;
}

interface QRISPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: "basic" | "vip" | "enterprise";
  billingCycle: "monthly" | "yearly";
  basePrice: number;
  userEmail?: string;
  onPaymentSuccess?: () => void;
}

export function QRISPaymentModal({
  isOpen,
  onClose,
  selectedPlan,
  billingCycle,
  basePrice,
  userEmail = "",
  onPaymentSuccess,
}: QRISPaymentModalProps) {
  const [mounted, setMounted] = useState(false);

  // Stage: 'form' (Stage 1) -> 'qris' (Stage 2)
  const [stage, setStage] = useState<"form" | "qris">("form");

  // Stage 1: Form Inputs
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    percentage: number;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creatingQris, setCreatingQris] = useState(false);

  // Stage 2: QRIS Active State
  const [qrisData, setQrisData] = useState<QRISTransactionData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(10 * 60);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const [manualStatusMsg, setManualStatusMsg] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);

  // Jaga callback tetap stabil agar interval polling tidak terus di-reset
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  useEffect(() => {
    onPaymentSuccessRef.current = onPaymentSuccess;
  }, [onPaymentSuccess]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset or setup when opened
  useEffect(() => {
    if (isOpen) {
      setStage("form");
      setEmail(userEmail || "");
      setWhatsapp("");
      setCouponCode("");
      setAppliedCoupon(null);
      setCouponError(null);
      setFormError(null);
      setCreatingQris(false);
      setIsSuccess(false);
      setIsExpired(false);
      setManualStatusMsg(null);
      setLastCheckedAt(null);
      setUpstreamError(null);
    }
  }, [isOpen, userEmail, selectedPlan, billingCycle]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Calculate current price breakdown in Stage 1
  const currentBasePrice = basePrice;
  const currentDiscountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const currentTotalAmount = Math.max(500, currentBasePrice - currentDiscountAmount);

  // Handle Validate Coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/payment/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          plan: selectedPlan,
          billingCycle: billingCycle,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kode kupon tidak valid.");
      }

      setAppliedCoupon({
        code: data.coupon.code,
        percentage: data.coupon.percentage,
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
      });
    } catch (err: any) {
      setCouponError(err.message || "Gagal menerapkan kupon.");
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  // Submit Stage 1 -> Create QRIS Transaction
  const handleSubmitOrderForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Harap masukkan alamat email Anda.");
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      setFormError("Nomor WhatsApp minimal 9 digit angka.");
      return;
    }

    setCreatingQris(true);

    try {
      const res = await fetch("/api/payment/create-qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billingCycle: billingCycle,
          email: email.trim(),
          whatsapp: cleanPhone,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat transaksi QRIS.");
      }

      setQrisData(data.transaction);
      setStage("qris");

      // Generate QR Code
      if (data.transaction.qrString) {
        const url = await QRCode.toDataURL(data.transaction.qrString, {
          width: 260,
          margin: 1.5,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
      }

      if (data.transaction.expiredAt) {
        const diff = Math.floor((new Date(data.transaction.expiredAt).getTime() - Date.now()) / 1000);
        // Batas waktu kedaluwarsa QRIS adalah 10 menit (cap ke nilai dari Pakasir bila lebih pendek)
        setTimeLeft(diff > 0 ? Math.min(diff, 10 * 60) : 10 * 60);
      } else {
        setTimeLeft(10 * 60);
      }
    } catch (err: any) {
      setFormError(err.message || "Gagal memproses pembayaran QRIS.");
    } finally {
      setCreatingQris(false);
    }
  };

  // Stage 2: Countdown Timer (10 menit) - saat habis, QRIS dianggap kedaluwarsa
  useEffect(() => {
    if (!isOpen || stage !== "qris" || isSuccess || timeLeft <= 0) {
      if (timeLeft <= 0 && isOpen && stage === "qris" && !isSuccess) setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, stage, isSuccess, timeLeft]);

  // Stage 2: Auto-Polling (Interval 5 detik - safe from Pakasir rate limit 4s)
  useEffect(() => {
    if (!isOpen || stage !== "qris" || !qrisData?.orderId || isSuccess || isExpired) return;

    const controller = new AbortController();

    const checkOnce = async () => {
      try {
        const res = await fetch(
          `/api/payment/check-status?orderId=${encodeURIComponent(qrisData.orderId)}`,
          { signal: controller.signal }
        );
        const statusData = await res.json();

        if (statusData?.checkedAt) setLastCheckedAt(statusData.checkedAt);

        if (statusData?.upstreamError) {
          setUpstreamError(
            statusData.upstreamMessage || "Gagal menghubungi server pembayaran."
          );
        } else {
          setUpstreamError(null);
        }

        if (statusData?.status === "completed") {
          setIsSuccess(true);
          if (onPaymentSuccessRef.current) onPaymentSuccessRef.current();
          return true;
        }

        if (statusData?.status === "canceled") {
          setIsExpired(true);
          return true;
        }

        return false;
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setUpstreamError("Koneksi ke server pembayaran terputus. Sistem akan mencoba lagi otomatis.");
        }
        return false;
      }
    };

    const pollInterval = setInterval(async () => {
      const done = await checkOnce();
      if (done) clearInterval(pollInterval);
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      controller.abort();
    };
    // onPaymentSuccess sengaja tidak jadi dependency (pakai ref agar interval stabil)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stage, qrisData, isSuccess, isExpired]);

  // Manual Check Status Button
  const handleManualCheckStatus = async () => {
    if (!qrisData?.orderId || manualChecking) return;
    setManualChecking(true);
    setManualStatusMsg(null);

    try {
      const res = await fetch(
        `/api/payment/check-status?orderId=${encodeURIComponent(qrisData.orderId)}`
      );
      const statusData = await res.json();

      if (statusData?.checkedAt) setLastCheckedAt(statusData.checkedAt);

      if (statusData?.status === "completed") {
        setUpstreamError(null);
        setIsSuccess(true);
        if (onPaymentSuccessRef.current) onPaymentSuccessRef.current();
        return;
      }

      if (statusData?.status === "canceled") {
        setIsExpired(true);
        return;
      }

      if (statusData?.upstreamError) {
        setUpstreamError(
          statusData.upstreamMessage || "Gagal menghubungi server pembayaran."
        );
        setManualStatusMsg("Pemeriksaan gagal. Lihat pesan di bawah.");
        return;
      }

      setManualStatusMsg(
        statusData?.upstreamMessage ||
          "Status masih menunggu. Pastikan QR sudah dipindai dan pembayaran berstatus Sukses."
      );
    } catch (err) {
      setManualStatusMsg("Gagal memeriksa status. Periksa koneksi internet Anda.");
      setUpstreamError("Tidak dapat menghubungi server pembayaran.");
    } finally {
      setManualChecking(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-scale-in">
      <div className="relative w-full max-w-md bg-[#11131d] border border-border rounded-2xl p-6 md:p-7 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-3.5 mb-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {stage === "form" ? "Konfirmasi Pemesanan" : "Pembayaran QRIS"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Paket <span className="text-indigo-300 font-semibold uppercase">{selectedPlan}</span> &bull; {billingCycle === "yearly" ? "Tahunan (Diskon 20%)" : "Bulanan"}
            </p>
            {stage === "qris" && qrisData?.isSandbox && (
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded">
                MODE SANDBOX &mdash; pembayaran hanya disimulasikan, dana bukan riil
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-muted hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ================= TAHAP 1: FORM INPUT EMAIL, WA & KUPON ================= */}
        {stage === "form" && (
          <form onSubmit={handleSubmitOrderForm} className="space-y-4 overflow-y-auto animate-step-enter">
            {formError && (
              <div className="p-2.5 bg-red-950/30 border border-red-500/30 text-red-300 text-xs rounded-lg">
                {formError}
              </div>
            )}

            {/* Input Email Manual */}
            <div>
              <label className="block text-xs font-semibold text-white mb-1" htmlFor="order-email">
                Alamat Email Anda
              </label>
              <input
                id="order-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors"
              />
              <p className="text-[10px] text-dim mt-1">Invoice dan detail transaksi akan dikirimkan ke email ini.</p>
            </div>

            {/* Input WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-white mb-1" htmlFor="order-wa">
                Nomor WhatsApp
              </label>
              <input
                id="order-wa"
                type="tel"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="misal: 081234567890"
                className="w-full px-3.5 py-2.5 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none transition-colors font-mono"
              />
              <p className="text-[10px] text-dim mt-1">Untuk konfirmasi pembayaran otomatis dan dukungan layanan.</p>
            </div>

            {/* Input Kode Diskon (Opsional) */}
            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Kode Kupon Diskon (Opsional)
              </label>
              
              {appliedCoupon ? (
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-300 font-mono">{appliedCoupon.code}</span>
                    <span className="text-emerald-400 text-[11px] ml-2 font-medium">
                      Diskon {appliedCoupon.percentage}% (-Rp {formatRupiah(appliedCoupon.discountAmount)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-[11px] text-red-300 hover:text-red-200 underline font-medium"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="misal: HEMAT20"
                    className="flex-1 px-3 py-2 bg-bg-input border border-border focus:border-primary-hover rounded-lg text-white text-xs outline-none uppercase font-mono"
                  />
                  <button
                    type="button"
                    disabled={validatingCoupon || !couponCode.trim()}
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 bg-bg-surface hover:bg-bg-hover disabled:opacity-50 border border-border text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {validatingCoupon ? "Memeriksa..." : "Terapkan"}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="text-[11px] text-red-400 mt-1">{couponError}</p>
              )}
            </div>

            {/* Rincian Biaya Transparan */}
            <div className="p-3.5 bg-bg-input border border-border rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-muted">
                <span>Harga Paket ({billingCycle === "yearly" ? "Tahunan" : "Bulanan"})</span>
                <span className="text-white font-medium">Rp {formatRupiah(currentBasePrice)}</span>
              </div>

              {appliedCoupon && (
                <div className="flex justify-between text-emerald-400 font-medium">
                  <span>Potongan Kupon ({appliedCoupon.code})</span>
                  <span>- Rp {formatRupiah(appliedCoupon.discountAmount)}</span>
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-border flex justify-between items-baseline font-bold">
                <span className="text-white text-xs">Total Pembayaran:</span>
                <span className="text-base text-primary-hover font-mono">
                  Rp {formatRupiah(currentTotalAmount)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creatingQris}
                className="flex-[2] py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/25"
              >
                {creatingQris ? "Menyiapkan QRIS..." : "Lanjut ke Pembayaran QRIS →"}
              </button>
            </div>
          </form>
        )}

        {/* ================= TAHAP 2: TAMPILAN QRIS PAKASIR ================= */}
        {stage === "qris" && qrisData && (
          <div className="space-y-4 overflow-y-auto animate-step-enter">
            {/* SUKSES SCREEN */}
            {isSuccess ? (
              <div className="py-6 text-center space-y-3 animate-scale-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-1">Pembayaran Berhasil Diterima!</h4>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Paket akun Anda telah aktif sebagai <strong className="text-indigo-300 uppercase">{qrisData.plan}</strong>.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      window.location.href = "/app";
                    }}
                    className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
                  >
                    Buka Workspace Sekarang →
                  </button>
                </div>
              </div>
            ) : isExpired ? (
              /* EXPIRED SCREEN */
              <div className="py-6 text-center space-y-3 animate-scale-in">
                <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-1">Waktu Pembayaran Habis</h4>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Batas waktu pembayaran QRIS (10 menit) telah habis. Silakan buat pesanan baru.
                  </p>
                </div>
                <button
                  onClick={() => setStage("form")}
                  className="w-full py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-xl transition-colors"
                >
                  Ulangi Pemesanan
                </button>
              </div>
            ) : (
              /* QRIS ACTIVE PAYMENT VIEW */
              <div className="space-y-3.5">
                {/* Total Tagihan Box */}
                <div className="p-3 bg-bg-input border border-border rounded-xl flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-dim uppercase tracking-wider font-semibold">Total Tagihan:</div>
                    <div className="text-base font-extrabold text-white">
                      Rp {formatRupiah(qrisData.totalPayment)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-dim font-medium">Batas Waktu:</div>
                    <div className="text-xs font-mono font-bold text-amber-400">
                      {formatTimer(timeLeft)}
                    </div>
                  </div>
                </div>

                {/* QR Code Image Container */}
                <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-xl shadow-inner">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="QRIS Pembayaran"
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-500 font-mono">
                      Memuat QRIS...
                    </div>
                  )}
                  <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-1">
                    QRIS &bull; GPN &bull; Bank Indonesia
                  </div>
                </div>

                {/* Status Live Polling Indicator */}
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-bg-input border border-border rounded-lg text-xs text-muted">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Menunggu pembayaran Anda...</span>
                </div>

                {/* Identitas Transaksi + Last Check */}
                <div className="p-2.5 bg-bg-input border border-border rounded-lg text-[10px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-dim shrink-0">Order ID</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(qrisData.orderId);
                        setManualStatusMsg("Order ID disalin.");
                      }}
                      className="font-mono text-indigo-300 hover:text-indigo-200 truncate"
                      title="Klik untuk menyalin"
                    >
                      {qrisData.orderId}
                    </button>
                  </div>
                  {qrisData.txnId && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-dim shrink-0">TXN ID</span>
                      <span className="font-mono text-indigo-300 truncate">{qrisData.txnId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-dim shrink-0">Terakhir dicek</span>
                    <span className="text-muted font-mono">
                      {lastCheckedAt
                        ? new Date(lastCheckedAt).toLocaleTimeString("id-ID")
                        : "Belum dicek"}
                    </span>
                  </div>
                </div>

                {/* Banner error upstream (bukan diam-diam) */}
                {upstreamError && (
                  <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 text-amber-300 text-[11px] rounded-lg leading-relaxed">
                    {upstreamError}
                  </div>
                )}

                {manualStatusMsg && (
                  <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg text-center">
                    {manualStatusMsg}
                  </div>
                )}

                {/* Action Buttons in QRIS Screen */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("form")}
                    className="flex-1 py-2 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-lg transition-colors"
                  >
                    ← Ubah Rincian
                  </button>
                  <button
                    type="button"
                    disabled={manualChecking}
                    onClick={handleManualCheckStatus}
                    className="flex-[1.5] py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {manualChecking ? "Memeriksa..." : "Cek Status Pembayaran"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
