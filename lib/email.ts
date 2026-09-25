import 'server-only';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ skipped: true } | { id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true };

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? 'Navaro CRM <noreply@navaro.com>';
  const result = await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html });
  return { id: result.data?.id ?? 'sent' };
}

function layout(heading: string, bodyHtml: string): string {
  return `
  <div style="background:#FFFAF3;padding:32px;font-family:sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E1E5DE;border-radius:16px;padding:32px;">
      <p style="color:#054742;font-weight:600;font-size:14px;letter-spacing:0;margin:0 0 24px;">Navaro CRM</p>
      <h1 style="color:#054742;font-size:20px;font-weight:500;margin:0 0 16px;">${heading}</h1>
      <div style="color:#054742;font-size:15px;line-height:1.5;">${bodyHtml}</div>
    </div>
  </div>`;
}

export interface LeadAssignedEmailInput {
  leadId: string;
  leadFullName: string;
  company: string;
  assigneeEmail: string;
  assigneeFirstName: string;
}

export function leadAssignedEmail(input: LeadAssignedEmailInput): SendEmailInput {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const leadUrl = `${appUrl}/leads/${encodeURIComponent(input.leadId)}`;
  const html = layout(
    'A lead was assigned to you',
    `
      <p>Hi ${escapeHtml(input.assigneeFirstName)},</p>
      <p><strong>${escapeHtml(input.leadFullName)}</strong> from <strong>${escapeHtml(input.company)}</strong> has been assigned to you.</p>
      <p><a href="${escapeHtml(leadUrl)}" style="color:#054742;">View the lead</a></p>
    `
  );
  return {
    to: input.assigneeEmail,
    subject: `Lead assigned: ${input.leadFullName}`,
    html,
  };
}
