import { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function setup() {
  const replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replset.getUri('navaro-crm-test');
  process.env.JWT_SECRET = 'a'.repeat(32);
  (process.env as Record<string, string>).NODE_ENV = 'test';

  return async () => {
    await replset.stop();
  };
}
