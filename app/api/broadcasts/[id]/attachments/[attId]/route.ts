import { withRoute } from '@/lib/api/handler';
import * as broadcasts from '@/services/broadcasts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Download one attached file. Always served as a download (never rendered in the app's origin). */
export const GET = withRoute({ permission: 'broadcasts.view' }, async ({ params }) => {
  const file = await broadcasts.getAttachment(params.id, params.attId);
  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.data.length),
      'Content-Disposition': `attachment; filename="${file.filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, no-store',
    },
  });
});
