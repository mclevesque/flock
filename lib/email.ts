import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}

// Use Resend's free tier default sender until a custom domain is added
const FROM = process.env.RESEND_FROM ?? "RYFT <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, username: string, resetUrl: string) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: "RYFT — Reset Your Password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d0d1a; color: #e0e0e0; border-radius: 12px;">
          <h1 style="font-size: 28px; font-weight: 900; font-style: italic; background: linear-gradient(120deg, #00e5ff, #a855f7, #d946ef); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0 0 24px;">RYFT</h1>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;">Hey <strong>${username}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Someone requested a password reset for your account. Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #00b4d8); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px;">Reset Password</a>
          <p style="font-size: 12px; color: #888; margin: 24px 0 0;">If you didn't request this, just ignore this email. Your password won't change.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    console.error("Failed to send reset email:", err);
    return { ok: false, error: err };
  }
}
