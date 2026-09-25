import { afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';

beforeAll(async () => {
  await connectDB();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// The connection is deliberately never closed here: with multiple test files
// sharing one forked process (vitest.config.ts pins a single fork so they all
// share the cached connectDB() connection), closing it in one file's afterAll
// raced other still-running files ("Client must be connected"). The process
// exiting when the run finishes cleans up the socket.
