/**
 * Vercel serverless entry. All /api/* requests are routed here (see vercel.json).
 * The Express app and the MongoDB connection are reused across warm invocations.
 */
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    return res.status(503).json({ success: false, message: 'Database unavailable, please retry' });
  }
  return app(req, res);
}
