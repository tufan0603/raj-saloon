import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';

connectDB()
  .then(() => {
    app.listen(env.port, () => console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`));
  })
  .catch((err) => {
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  });
