import Lead from '@/models/Lead';
import Client from '@/models/Client';
import { hasPermission } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';
import { serializeLead } from '@/services/leads';

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function leadsSection() {
  const filter = { isActive: true };
  const [total, newThisMonth, byStage, bySource, openPipeline, recent] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.countDocuments({ ...filter, createdAt: { $gte: startOfMonth() } }),
    Lead.aggregate([{ $match: filter }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Lead.aggregate([
      { $match: filter },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Lead.aggregate([
      { $match: { ...filter, stage: { $nin: ['won', 'lost'] } } },
      { $group: { _id: '$estimatedBudget.currency', total: { $sum: '$estimatedBudget.max' } } },
    ]),
    Lead.find(filter).sort({ createdAt: -1 }).limit(5).populate('assignedTo', 'firstName lastName'),
  ]);

  return {
    total,
    newThisMonth,
    byStage: Object.fromEntries(byStage.map((s) => [s._id, s.count])),
    bySourceTop5: bySource.map((s) => ({ source: s._id, count: s.count })),
    openPipelineByCurrency: Object.fromEntries(openPipeline.filter((p) => p._id).map((p) => [p._id, p.total])),
    recent: recent.map(serializeLead),
  };
}

async function clientsSection() {
  const filter = { isActive: true };
  const [total, active, newThisMonth, byStatus] = await Promise.all([
    Client.countDocuments(filter),
    Client.countDocuments({ ...filter, status: 'active' }),
    Client.countDocuments({ ...filter, createdAt: { $gte: startOfMonth() } }),
    Client.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    total,
    active,
    newThisMonth,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
  };
}

export async function getDashboard(actor: SessionUser) {
  const [leads, clients] = await Promise.all([
    hasPermission(actor, 'leads.view') ? leadsSection() : null,
    hasPermission(actor, 'clients.view') ? clientsSection() : null,
  ]);

  return { leads, clients };
}
