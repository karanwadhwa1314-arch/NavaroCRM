import sanitizeHtml from 'sanitize-html';
import { escapeHtml } from '@/lib/email';

/** Everything the editor can produce. Anything else (scripts, styles, iframes, event handlers...) is dropped. */
export function sanitizeBroadcastHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'hr'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      div: 'p',
      h1: 'h2',
      h4: 'h3',
      h5: 'h3',
      h6: 'h3',
    },
  }).trim();
}

/** Visible text of an HTML fragment — used for "is the body empty?" validation and the plain-text part. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\/(p|h2|h3|blockquote|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]+>/g, '')} (${href})`);
  return withBreaks
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The only personalisation supported for now: the lead's first name. `{{first_name}}`, any spacing/case. */
const FIRST_NAME_TOKEN = /\{\{\s*first_name\s*\}\}/gi;

export function mergeText(text: string, firstName?: string): string {
  return text.replace(FIRST_NAME_TOKEN, () => (firstName && firstName.trim()) || 'there');
}

export function mergeHtml(html: string, firstName?: string): string {
  return html.replace(FIRST_NAME_TOKEN, () => escapeHtml((firstName && firstName.trim()) || 'there'));
}

const GREEN = '#054742';
const HEATH = '#FFFAF3';

/** Inline styles are applied after sanitising, when the tags are known to be attribute-free. */
function styleContent(html: string): string {
  return html
    .replace(/<p>/g, `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${GREEN};">`)
    .replace(/<h2>/g, `<h2 style="margin:24px 0 12px;font-size:22px;line-height:1.2;font-weight:500;color:${GREEN};">`)
    .replace(/<h3>/g, `<h3 style="margin:20px 0 10px;font-size:18px;line-height:1.2;font-weight:500;color:${GREEN};">`)
    .replace(/<(ul|ol)>/g, `<$1 style="margin:0 0 16px;padding-left:22px;font-size:16px;line-height:1.55;color:${GREEN};">`)
    .replace(/<li>/g, '<li style="margin:0 0 6px;">')
    .replace(/<blockquote>/g, `<blockquote style="margin:0 0 16px;padding:4px 0 4px 16px;border-left:4px solid #3ECEB9;color:${GREEN};">`)
    .replace(/<hr\s*\/?>/g, '<hr style="border:none;border-top:1px solid #E1E5DE;margin:24px 0;" />')
    .replace(/<a href=/g, `<a style="color:${GREEN};text-decoration:underline;" href=`);
}

export interface RenderInput {
  content: string; // sanitised HTML
  preview: string;
  firstName?: string;
  logoUrl?: string;
  /** Public folder holding Utendo-{Light,Regular,Medium}.woff2 (e.g. https://app/fonts). Omit to skip @font-face. */
  fontBaseUrl?: string;
  /** CRM preview only: leave {{first_name}} as typed instead of merging a name in. */
  keepTokens?: boolean;
}

/** Utendo first (brand), Poppins as the documented fallback, then safe system fonts. Many mail apps (e.g. Gmail) ignore web fonts and use the fallbacks. */
export const EMAIL_FONT_STACK = "Utendo,Poppins,Helvetica,Arial,sans-serif";

function fontFaces(baseUrl?: string): string {
  if (!baseUrl) return '';
  const face = (file: string, weight: number) =>
    `@font-face{font-family:'Utendo';font-weight:${weight};font-style:normal;src:url('${escapeHtml(baseUrl)}/${file}.woff2') format('woff2');}`;
  return `<style>${face('Utendo-Light', 300)}${face('Utendo-Regular', 400)}${face('Utendo-Medium', 500)}</style>`;
}

/** Final HTML for one recipient: brand shell + hidden preheader + merged, styled body. */
export function renderBroadcastHtml({ content, preview, firstName, logoUrl, fontBaseUrl, keepTokens }: RenderInput): string {
  const body = styleContent(keepTokens ? content : mergeHtml(content, firstName));
  const preheader = escapeHtml(keepTokens ? preview : mergeText(preview, firstName));
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Navaro" height="36" style="display:block;height:36px;width:auto;border:0;margin:0 0 28px;" />`
    : `<p style="margin:0 0 28px;font-size:18px;font-weight:500;color:${GREEN};">navaro</p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">${fontFaces(fontBaseUrl)}</head>
<body style="margin:0;padding:0;background:${HEATH};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${HEATH};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border:1px solid #E1E5DE;border-radius:16px;"><tr><td style="padding:32px;font-family:${EMAIL_FONT_STACK};font-weight:300;color:${GREEN};">
${logo}
${body}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function renderBroadcastText(input: { content: string; firstName?: string }): string {
  return mergeText(htmlToText(input.content), input.firstName);
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/.test(email);
}
