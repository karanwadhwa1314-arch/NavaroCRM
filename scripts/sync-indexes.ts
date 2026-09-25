import { connectDB } from '@/lib/db';
import User from '@/models/User';
import Lead from '@/models/Lead';
import Client from '@/models/Client';
import AuditLog from '@/models/AuditLog';

async function main() {
  await connectDB();

  for (const model of [User, Lead, Client, AuditLog]) {
    const result = await model.syncIndexes();
    console.log(`${model.modelName}: synced indexes`, result);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
