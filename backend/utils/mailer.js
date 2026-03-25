const { Resend } = require('resend');
const { welcomeEmailHtml } = require('../emails/welcome');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'Tenderoots <no-reply@tenderoots.com>';

/**
 * Send a welcome email to a newly registered user.
 * Non-throwing — logs errors but does not crash the caller.
 *
 * @param {{ name: string, email: string }} user
 */
async function sendWelcomeEmail({ name, email }) {
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: `Welcome to Tenderoots, ${name ? name.split(' ')[0] : 'Friend'}! 🌱`,
      html: welcomeEmailHtml({ name }),
    });

    if (error) {
      console.error('❌ Resend error sending welcome email to', email, ':', error);
    } else {
      console.log('✅ Welcome email sent to', email);
    }
  } catch (err) {
    console.error('❌ Failed to send welcome email to', email, ':', err.message);
  }
}

module.exports = { sendWelcomeEmail };
