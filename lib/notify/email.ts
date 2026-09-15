/**
 * Optional transactional email. No-ops without RESEND_API_KEY + EMAIL_FROM
 * so local and e2e never depend on a mailer.
 */

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
