import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import AuditLog from '@/models/AuditLog';
import Project from '@/models/Project';
import ProjectCard from '@/models/ProjectCard';
import Broadcast from '@/models/Broadcast';
import BroadcastDelivery from '@/models/BroadcastDelivery';
import BroadcastAttachment from '@/models/BroadcastAttachment';

async function main() {
  await connectDB();

  for (const model of [User, Lead, Client, Project, ProjectCard, AuditLog, Broadcast, BroadcastDelivery, BroadcastAttachment]) {
    const result = await model.syncIndexes();
    console.log(`${model.modelName}: synced indexes`, result);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
