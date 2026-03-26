/**
 * Password reset email HTML template.
 * @param {{ name: string, resetLink: string }} params
 * @returns {string} HTML string
 */
function passwordResetEmailHtml({ name, resetLink }) {
  const firstName = name ? name.split(' ')[0] : 'Friend';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:48px;line-height:1;">🔐</p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Tenderoots</h1>
              <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">Password Reset Request</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px 32px;">
              <h2 style="margin:0 0 12px;color:#15803d;font-size:22px;font-weight:700;">
                Hi ${firstName} 👋
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                We received a request to reset your Tenderoots password. Click the button below to choose a new one.
              </p>
              <p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.6;">
                This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your account is still secure.
              </p>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;">
                      Reset My Password 🔑
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:8px 0 0;word-break:break-all;">
                <a href="${resetLink}" style="color:#16a34a;font-size:13px;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">
                Made with ❤️ for little hearts everywhere
              </p>
              <p style="margin:0;color:#d1d5db;font-size:12px;">
                &copy; 2025 Tenderoots (Catch Them Young) &nbsp;·&nbsp;
                <a href="https://tenderoots.com" style="color:#16a34a;text-decoration:none;">tenderoots.com</a>
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

module.exports = { passwordResetEmailHtml };
