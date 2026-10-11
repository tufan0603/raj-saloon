import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB. The connection promise is cached on globalThis so that
 * serverless platforms (Vercel, Netlify functions) reuse one connection per warm instance.
 */
const cache = globalThis.__saloonease_mongo || (globalThis.__saloonease_mongo = { conn: null, promise: null });

export async function connectDB() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(env.mongoUri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 10 })
      .then((m) => {
        console.log(`[db] connected: ${m.connection.name}`);
        return m;
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
