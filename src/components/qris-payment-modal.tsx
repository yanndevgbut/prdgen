"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { formatRupiah } from "@/lib/utils";

export interface QRISTransactionData {
  orderId: string;
  txnId: string;
  plan: string;
  billingCycle: string;
  amount: number;
  fee: number;
  totalPayment: number;
  qrString: string;
  expiredAt: string;
}

interface QRISPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: QRISTransactionData | null;
  onPaymentSuccess?: () => void;
}

export function QRISPaymentModal({
  isOpen,
  onClose,
  data,
  onPaymentSuccess,
}: QRISPaymentModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate QR image from qr_string
  useEffect(() => {
    if (data?.qrString) {
      QRCode.toDataURL(data.qrString, {
        width: 260,
        margin: 1.5,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Gagal render QRIS:", err));
    }

    if (data?.expiredAt) {
      const diff = Math.floor((new Date(data.expiredAt).getTime() - Date.now()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    } else {
      setTimeLeft(15 * 60);
    }

    setIsSuccess(false);
    setIsExpired(false);
  }, [data]);

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

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isSuccess || timeLeft <= 0) {
      if (timeLeft <= 0 && isOpen && !isSuccess) setIsExpired(true);
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
  }, [isOpen, isSuccess, timeLeft]);

  // Polling check payment status
  useEffect(() => {
    if (!isOpen || !data?.orderId || isSuccess || isExpired) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/check-status?orderId=${encodeURIComponent(data.orderId)}`);
        const statusData = await res.json();

        if (statusData?.status === "completed") {
          setIsSuccess(true);
          clearInterval(pollInterval);
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
        }
      } catch (err) {
        // Silent polling error
      }
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [isOpen, data, isSuccess, isExpired, onPaymentSuccess]);

  if (!isOpen || !data || !mounted) return null;

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
              Pembayaran QRIS
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Paket <span className="text-indigo-300 font-semibold uppercase">{data.plan}</span> &bull; {data.billingCycle === "yearly" ? "Tahunan (Diskon 20%)" : "Bulanan"}
            </p>
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

        {/* SUKSES SCREEN */}
        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">Pembayaran Berhasil!</h4>
              <p className="text-xs text-muted max-w-xs mx-auto">
                Akun Anda telah berhasil di-upgrade ke paket <strong className="text-indigo-300 uppercase">{data.plan}</strong>.
              </p>
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  onClose();
                  window.location.href = "/app";
                }}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
              >
                Buka Workspace Sekarang &rarr;
              </button>
            </div>
          </div>
        ) : isExpired ? (
          /* EXPIRED SCREEN */
          <div className="py-8 text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-white mb-1">Waktu Pembayaran Habis</h4>
              <p className="text-xs text-muted max-w-xs mx-auto">
                QRIS transaksi ini telah kedaluwarsa. Silakan lakukan pemesanan ulang untuk mendapatkan kode QR baru.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-bg-surface hover:text-white border border-border text-muted text-xs font-semibold rounded-xl transition-colors"
            >
              Tutup
            </button>
          </div>
        ) : (
          /* QRIS ACTIVE PAYMENT VIEW */
          <div className="space-y-4 overflow-y-auto">
            
            {/* Total Tagihan Box */}
            <div className="p-3.5 bg-bg-input border border-border rounded-xl flex justify-between items-center">
              <div>
                <div className="text-[11px] text-dim font-medium uppercase tracking-wider">Total Tagihan:</div>
                <div className="text-lg font-extrabold text-white">
                  Rp {formatRupiah(data.totalPayment)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-dim font-medium">Batas Waktu:</div>
                <div className="text-xs font-mono font-bold text-amber-400">
                  {formatTimer(timeLeft)}
                </div>
              </div>
            </div>

            {/* QRIS Code Image Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-inner">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QRIS Pembayaran"
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-500 font-mono">
                  Memuat QRIS...
                </div>
              )}
              <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-1">
                QRIS &bull; GPN &bull; Bank Indonesia
              </div>
            </div>

            {/* Status Live Polling Indicator */}
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-bg-input border border-border rounded-lg text-xs text-muted">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Menunggu pembayaran Anda...</span>
            </div>

            {/* Petunjuk Singkat */}
            <div className="p-3 bg-bg-surface/50 border border-border rounded-lg text-[11px] text-dim space-y-1">
              <div className="font-semibold text-muted">Cara Pembayaran:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-dim">
                <li>Buka aplikasi BCA, Mandiri, GoPay, OVO, DANA, atau ShopeePay.</li>
                <li>Pilih menu <strong>Scan QR / Bayar QRIS</strong>.</li>
                <li>Arahkan kamera ke kode QR di atas & selesaikan pembayaran.</li>
              </ol>
            </div>

            {/* Tombol Batal */}
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-dim hover:text-muted transition-colors font-medium text-center"
            >
              Batalkan Transaksi
            </button>

          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
