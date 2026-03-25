/**
 * Welcome email HTML template.
 * @param {{ name: string }} params
 * @returns {string} HTML string
 */
function welcomeEmailHtml({ name }) {
  const firstName = name ? name.split(' ')[0] : 'Friend';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Tenderoots!</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:48px;line-height:1;">🌱</p>
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">Tenderoots</h1>
              <p style="margin:6px 0 0;color:#bbf7d0;font-size:14px;">Daily Bible Verses &amp; Moral Lessons for Kids</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px 32px;">
              <h2 style="margin:0 0 12px;color:#15803d;font-size:22px;font-weight:700;">
                Welcome, ${firstName}! 🎉
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                We're so happy you joined the Tenderoots family! Every day you'll get a fresh Bible verse and a moral lesson to help your heart grow stronger in faith, kindness, and love.
              </p>
              <p style="margin:0 0 28px;color:#374151;font-size:16px;line-height:1.6;">
                Here's what's waiting for you:
              </p>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0fdf4;">
                    <span style="font-size:20px;">📖</span>
                    <span style="margin-left:10px;color:#374151;font-size:15px;"><strong>Daily Bible Verses</strong> — tailored to your age group</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0fdf4;">
                    <span style="font-size:20px;">💡</span>
                    <span style="margin-left:10px;color:#374151;font-size:15px;"><strong>Moral Lessons</strong> — simple truths to live by</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0fdf4;">
                    <span style="font-size:20px;">🎮</span>
                    <span style="margin-left:10px;color:#374151;font-size:15px;"><strong>Fun Games &amp; Challenges</strong> — learn while you play</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:20px;">🏆</span>
                    <span style="margin-left:10px;color:#374151;font-size:15px;"><strong>Streaks &amp; Rewards</strong> — keep growing every day</span>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://tenderoots.com/authentication/login.html"
                       style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;">
                      Open My Dashboard ✨
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Verse banner -->
          <tr>
            <td style="background:#f0fdf4;padding:24px 32px;text-align:center;border-top:1px solid #dcfce7;">
              <p style="margin:0 0 4px;color:#15803d;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Today's reminder</p>
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;font-style:italic;">
                "Train up a child in the way he should go; even when he is old he will not depart from it."
              </p>
              <p style="margin:6px 0 0;color:#6b7280;font-size:13px;">— Proverbs 22:6</p>
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

module.exports = { welcomeEmailHtml };
