import { Resend } from "resend";

let resendClient: Resend | null = null;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY belum disetel di environment variables.");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function renderOTPEmailHtml(params: {
  fullName: string;
  otpCode: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kode Verifikasi Akun PRDGen</title>
</head>
<body style="margin:0; padding:0; background-color:#0E0E0F; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; color:#F2F0EB; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0E0E0F; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px; background-color:#161617; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:36px 32px; text-align:left;">
          
          <!-- Brand Logo Header -->
          <tr>
            <td style="padding-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">PRD<span style="color:#FF8A8A;">Gen</span></span>
            </td>
          </tr>

          <!-- Greeting & Main Message -->
          <tr>
            <td style="padding-top:28px;">
              <h1 style="font-size:20px; font-weight:700; color:#ffffff; margin:0 0 12px 0; letter-spacing:-0.3px;">Verifikasi akunmu</h1>
              <p style="font-size:14px; color:#94a3b8; line-height:1.6; margin:0 0 8px 0;">
                Halo ${escapeHtml(params.fullName || "Pengguna")},
              </p>
              <p style="font-size:14px; color:#94a3b8; line-height:1.6; margin:0 0 28px 0;">
                Gunakan kode verifikasi (OTP) berikut untuk menyelesaikan pendaftaran akunmu di PRDGen:
              </p>
            </td>
          </tr>

          <!-- OTP Box Card -->
          <tr>
            <td align="center" style="padding:4px 0 28px 0;">
              <div style="background-color:#1A1A1C; border:1.5px solid #B23A32; border-radius:10px; padding:18px 28px; display:inline-block;">
                <span style="font-family:'Courier New', Courier, monospace; font-size:36px; font-weight:800; letter-spacing:10px; color:#FF8A8A;">${params.otpCode}</span>
              </div>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td>
              <p style="font-size:12px; color:#64748b; line-height:1.6; margin:0 0 24px 0;">
                Kode verifikasi ini hanya berlaku selama <strong>10 menit</strong>. Jangan berikan kode ini kepada siapa pun.
              </p>
              <p style="font-size:12px; color:#64748b; line-height:1.6; margin:0 0 24px 0;">
                Kalau kamu tidak mendaftar di PRDGen, abaikan email ini.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px; border-top:1px solid rgba(255,255,255,0.08); text-align:center;">
              <p style="font-size:11px; color:#64748b; margin:0; line-height:1.5;">
                &copy; ${new Date().getFullYear()} PRDGen. Platform Pembuatan PRD Otomatis Berbasis AI.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOTPEmail(params: {
  email: string;
  fullName: string;
  otpCode: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResendClient();

  if (!resend) {
    console.warn(
      `[DEV EMAIL NOTICE] RESEND_API_KEY belum dikonfigurasi. Kode OTP untuk ${params.email}: ${params.otpCode}`
    );
    return {
      success: true,
      error: "RESEND_API_KEY belum disetel. (Lihat log console server untuk kode OTP).",
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "PRDGen <onboarding@resend.dev>";
  const htmlContent = renderOTPEmailHtml(params);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [params.email],
      subject: `Kode Verifikasi Akun PRDGen: ${params.otpCode}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend API send error:", error);
      return {
        success: false,
        error: error.message || "Gagal mengirimkan email melalui Resend.",
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err: any) {
    console.error("Resend network exception:", err);
    return {
      success: false,
      error: err.message || "Terjadi kesalahan jaringan saat mengirim email.",
    };
  }
}

export function renderResetPasswordEmailHtml(params: {
  fullName?: string;
  otpCode: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Kata Sandi Akun PRDGen</title>
</head>
<body style="margin:0; padding:0; background-color:#0E0E0F; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; color:#F2F0EB; -webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0E0E0F; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px; background-color:#161617; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:36px 32px; text-align:left;">
          
          <!-- Brand Logo Header -->
          <tr>
            <td style="padding-bottom:24px; border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">PRD<span style="color:#FF8A8A;">Gen</span></span>
            </td>
          </tr>

          <!-- Greeting & Main Message -->
          <tr>
            <td style="padding-top:28px;">
              <h1 style="font-size:20px; font-weight:700; color:#ffffff; margin:0 0 12px 0; letter-spacing:-0.3px;">Reset Kata Sandi Akun</h1>
              <p style="font-size:14px; color:#94a3b8; line-height:1.6; margin:0 0 8px 0;">
                Halo ${escapeHtml(params.fullName || "Pengguna")},
              </p>
              <p style="font-size:14px; color:#94a3b8; line-height:1.6; margin:0 0 28px 0;">
                Kami menerima permintaan untuk mengatur ulang kata sandi akun PRDGen-mu. Gunakan kode OTP 6 digit berikut:
              </p>
            </td>
          </tr>

          <!-- OTP Box Card -->
          <tr>
            <td align="center" style="padding:4px 0 28px 0;">
              <div style="background-color:#1A1A1C; border:1.5px solid #B23A32; border-radius:10px; padding:18px 28px; display:inline-block;">
                <span style="font-family:'Courier New', Courier, monospace; font-size:36px; font-weight:800; letter-spacing:10px; color:#FF8A8A;">${params.otpCode}</span>
              </div>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td>
              <p style="font-size:12px; color:#64748b; line-height:1.6; margin:0 0 24px 0;">
                Kode OTP ini hanya berlaku selama <strong>10 menit</strong>. Kalau kamu tidak meminta reset kata sandi, abaikan email ini. Akunmu tetap aman.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px; border-top:1px solid rgba(255,255,255,0.08); text-align:center;">
              <p style="font-size:11px; color:#64748b; margin:0; line-height:1.5;">
                &copy; ${new Date().getFullYear()} PRDGen. Platform Pembuatan PRD Otomatis Berbasis AI.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(params: {
  email: string;
  fullName?: string;
  otpCode: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResendClient();

  if (!resend) {
    console.warn(
      `[DEV EMAIL NOTICE] RESEND_API_KEY belum dikonfigurasi. Kode OTP Reset untuk ${params.email}: ${params.otpCode}`
    );
    return {
      success: true,
      error: "RESEND_API_KEY belum disetel. (Lihat log console server untuk kode OTP).",
    };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "PRDGen <onboarding@resend.dev>";
  const htmlContent = renderResetPasswordEmailHtml(params);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [params.email],
      subject: `Kode OTP Reset Kata Sandi PRDGen: ${params.otpCode}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend API password reset error:", error);
      return {
        success: false,
        error: error.message || "Gagal mengirimkan email reset sandi melalui Resend.",
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (err: any) {
    console.error("Resend network exception:", err);
    return {
      success: false,
      error: err.message || "Terjadi kesalahan jaringan saat mengirim email.",
    };
  }
}
