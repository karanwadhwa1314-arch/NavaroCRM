import 'server-only';
import mongoose from 'mongoose';

declare global {
  // eslint-disable-next-line no-var
  var __navaroMongoose: Promise<typeof mongoose> | undefined;
}

export function connectDB(): Promise<typeof mongoose> {
  if (global.__navaroMongoose) return global.__navaroMongoose;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set.');
  }

  mongoose.set('strictQuery', true);

  global.__navaroMongoose = mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  return global.__navaroMongoose;
}
