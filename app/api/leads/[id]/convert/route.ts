import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/api/handler';
import { forbidden } from '@/lib/api/errors';
import { hasPermission } from '@/lib/auth/session';
import * as leads from '@/services/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRoute({ permission: 'leads.edit' }, async ({ actor, params }) => {
  if (!hasPermission(actor, 'clients.create')) {
    throw forbidden('You need permission to create clients to convert this lead');
  }
  const result = await leads.convertToClient(actor, params.id);
  return NextResponse.json(
    {
      success: true,
      converted: true,
      message: result.alreadyConverted ? 'This lead was already converted to a client' : 'Lead converted to client',
      data: { client: result.client, lead: result.lead },
    },
    { status: result.alreadyConverted ? 200 : 201 }
  );
});
