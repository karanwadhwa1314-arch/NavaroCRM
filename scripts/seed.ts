/**
 * Idempotent env-driven seed. `npm run seed` creates the first superadmin
 * (if none exists yet) and syncs indexes. `npm run seed:demo` additionally
 * creates fictional demo data — refuses to run in production.
 */
import { connectDB } from '@/lib/db';
import User, { type UserDocument } from '@/models/User';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import Project from '@/models/Project';
import ProjectCard from '@/models/ProjectCard';
import AuditLog from '@/models/AuditLog';
import Broadcast from '@/models/Broadcast';
import BroadcastDelivery from '@/models/BroadcastDelivery';
import BroadcastAttachment from '@/models/BroadcastAttachment';
import { roleDefaultPermissions } from '@/lib/permissions';
import type { LeadStage, LeadSource, Priority, Currency } from '@/lib/constants';

const DEMO = process.argv.includes('--demo');

async function seedSuperadmin(): Promise<UserDocument> {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  const firstName = process.env.SEED_SUPERADMIN_FIRST_NAME;
  const lastName = process.env.SEED_SUPERADMIN_LAST_NAME;

  if (!email || !password || !firstName || !lastName) {
    throw new Error(
      'SEED_SUPERADMIN_EMAIL, SEED_SUPERADMIN_PASSWORD, SEED_SUPERADMIN_FIRST_NAME and SEED_SUPERADMIN_LAST_NAME must all be set.'
    );
  }

  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) {
    console.log(`A superadmin already exists (${existing.email}); skipping.`);
    return existing;
  }

  const superadmin = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    role: 'superadmin',
    permissions: [],
  });
  console.log(`Created superadmin ${superadmin.email}`);
  return superadmin;
}

const DEMO_MARKER_EMAIL = 'amina.hassan@example.com';

async function seedDemo(superadmin: UserDocument) {
  const alreadySeeded = await User.findOne({ email: DEMO_MARKER_EMAIL });
  if (alreadySeeded) {
    console.log('Demo data already present; skipping.');
    return;
  }

  const members = await User.create([
    {
      firstName: 'Amina',
      lastName: 'Hassan',
      email: DEMO_MARKER_EMAIL,
      password: 'DemoPass123!',
      role: 'member',
      permissions: roleDefaultPermissions('member'),
    },
    {
      firstName: 'Farid',
      lastName: 'Rahman',
      email: 'farid.rahman@example.com',
      password: 'DemoPass123!',
      role: 'admin',
      permissions: roleDefaultPermissions('admin'),
    },
  ]);
  const [amina, farid] = members;
  console.log(`Created ${members.length} demo users`);

  const stages: LeadStage[] = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const sources: LeadSource[] = ['website', 'referral', 'linkedin', 'cold_call', 'conference', 'advertisement', 'partner', 'other'];
  const priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
  const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'AED'];

  const companies = [
    'Meridian Freight Co',
    'Bluewater Exports',
    'Sahara Grain Traders',
    'Pacific Rim Logistics',
    'Atlas Commodities',
    'Silk Route Trading',
    'Northshore Shipping',
    'Delta Import Partners',
    'Crescent Trade Group',
    'Harborline Freight',
    'Monsoon Traders',
    'Continental Cargo Ltd',
  ];

  const leadDocs = companies.map((company, i) => {
    const stage = stages[i % stages.length];
    const slug = company.toLowerCase().replace(/[^a-z]+/g, '.');
    return {
      firstName: ['Omar', 'Lena', 'Noah', 'Priya', 'Kwame', 'Yara'][i % 6],
      lastName: ['Idris', 'Novak', 'Carter', 'Sharma', 'Mensah', 'Haddad'][i % 6],
      email: `contact@${slug}.example.com`,
      company,
      companySize: ['1-10', '11-50', '51-200', '201-500'][i % 4] as never,
      industry: 'Import / export',
      source: sources[i % sources.length],
      stage,
      priority: priorities[i % priorities.length],
      estimatedBudget: { min: 10000 * (i + 1), max: 25000 * (i + 1), currency: currencies[i % currencies.length] },
      assignedTo: i % 2 === 0 ? amina._id : farid._id,
      createdBy: superadmin._id,
      stageHistory: [{ stage: 'new', changedAt: new Date(), changedBy: superadmin._id }],
      activities: [{ type: 'note', description: 'Lead created', user: superadmin._id }],
      lostReason: stage === 'lost' ? 'Budget reallocated' : undefined,
    };
  });

  const leads = await Lead.create(leadDocs);
  console.log(`Created ${leads.length} demo leads`);

  const wonLead = leads.find((l) => l.stage === 'won');
  if (wonLead) {
    const client = await Client.create({
      companyName: wonLead.company,
      industry: wonLead.industry,
      companySize: wonLead.companySize,
      contacts: [{ firstName: wonLead.firstName, lastName: wonLead.lastName, email: wonLead.email, isPrimary: true }],
      source: 'lead_conversion',
      convertedFromLead: wonLead._id,
      accountManager: wonLead.assignedTo,
      status: 'active',
      currency: wonLead.estimatedBudget?.currency ?? 'USD',
      createdBy: superadmin._id,
    });
    wonLead.convertedToClient = client._id;
    wonLead.convertedAt = new Date();
    await wonLead.save();
  }

  const otherClients = [
    { companyName: 'Vantage Marine Supply', industry: 'Maritime equipment', status: 'active', tier: 'premium', currency: 'USD' },
    { companyName: 'Coral Bay Produce', industry: 'Agriculture', status: 'prospect', tier: 'standard', currency: 'EUR' },
    { companyName: 'Ironclad Freight Alliance', industry: 'Logistics', status: 'active', tier: 'enterprise', currency: 'GBP' },
  ] as const;

  for (const c of otherClients) {
    await Client.create({
      ...c,
      contacts: [{ firstName: 'Contact', lastName: c.companyName.split(' ')[0], email: `hello@${c.companyName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`, isPrimary: true }],
      source: 'direct',
      accountManager: farid._id,
      createdBy: superadmin._id,
    });
  }
  console.log(`Created ${otherClients.length + (wonLead ? 1 : 0)} demo clients`);
}

/** Two fictional projects with a spread of card states, so the Projects pages have something to show. */
async function seedDemoProjects(superadmin: UserDocument) {
  if (await Project.exists({})) {
    console.log('Projects already present; skipping demo projects.');
    return;
  }
  const amina = await User.findOne({ email: DEMO_MARKER_EMAIL });
  const farid = await User.findOne({ email: 'farid.rahman@example.com' });
  const vantage = await Client.findOne({ companyName: 'Vantage Marine Supply' });
  const ironclad = await Client.findOne({ companyName: 'Ironclad Freight Alliance' });
  if (!amina || !farid || !vantage || !ironclad) {
    console.log('Demo users/clients not found; skipping demo projects.');
    return;
  }

  const day = 24 * 60 * 60 * 1000;
  const ago = (d: number) => new Date(Date.now() - d * day);
  const inDays = (d: number) => new Date(Date.now() + d * day);

  const onTrack = await Project.create({
    name: 'Vantage-Marine-Supply-Port clearance',
    code: 'VAN-POR-001',
    client: vantage._id,
    description: 'Customs clearance and inland haulage for the Q3 equipment shipment.',
    status: 'in_progress',
    priority: 'high',
    startDate: ago(30),
    projectManager: farid._id,
    team: [
      { user: amina._id, role: 'logistics' },
      { user: farid._id, role: 'project_manager' },
    ],
    activities: [{ type: 'created', description: 'Project created', user: superadmin._id }],
    createdBy: superadmin._id,
  });
  const slipping = await Project.create({
    name: 'Ironclad-Freight-Alliance-Carrier onboarding',
    code: 'IRO-CAR-001',
    client: ironclad._id,
    description: 'Qualify and onboard three new regional carriers.',
    status: 'planning',
    priority: 'urgent',
    startDate: ago(12),
    projectManager: amina._id,
    team: [{ user: farid._id, role: 'compliance' }],
    activities: [{ type: 'created', description: 'Project created', user: superadmin._id }],
    createdBy: superadmin._id,
  });

  await ProjectCard.create([
    { project: onTrack._id, title: 'Book container slot', status: 'done', doneAt: ago(2), assignees: [amina._id], createdBy: farid._id, deadline: ago(3) },
    { project: onTrack._id, title: 'Submit customs documents', status: 'in_progress', deadline: inDays(2), assignees: [amina._id, farid._id], createdBy: farid._id, description: 'Bill of lading, packing list and the certificate of origin.' },
    { project: onTrack._id, title: 'Confirm haulage quote', status: 'todo', assignees: [farid._id], createdBy: farid._id },
    { project: slipping._id, title: 'Collect carrier insurance certificates', status: 'in_progress', deadline: ago(3), assignees: [farid._id], createdBy: amina._id },
    { project: slipping._id, title: 'Run sanctions screening', status: 'todo', deadline: ago(1), assignees: [farid._id], createdBy: amina._id },
    { project: slipping._id, title: 'Weekly status call', status: 'todo', deadline: inDays(5), assignees: [amina._id], createdBy: amina._id, recurrence: { type: 'weekly', daysOfWeek: [4] } },
  ]);
  console.log('Created 2 demo projects with cards');
}

async function main() {
  if (DEMO && process.env.NODE_ENV === 'production') {
    console.error('Refusing to run --demo in production.');
    process.exit(1);
  }

  await connectDB();

  const superadmin = await seedSuperadmin();

  for (const model of [User, Lead, Client, Project, ProjectCard, AuditLog, Broadcast, BroadcastDelivery, BroadcastAttachment]) {
    await model.syncIndexes();
  }

  if (DEMO) {
    await seedDemo(superadmin);
    await seedDemoProjects(superadmin);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
