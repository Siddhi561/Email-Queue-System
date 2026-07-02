import 'dotenv/config';
import express from 'express';
import logger from './config/logger.js';
import { initDB } from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import emailRoutes from './routes/emailRoutes.js';
import {fileURLToPath} from 'url';
import path from 'path';
// console.log('REDIS_URL:', process.env.REDIS_URL);

const app = express();
app.use(express.json());


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

//route
app.use('/api/email', emailRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

// console.log('DB URL:', process.env.DATABASE_URL);
const start = async () => {
  try {
    await initDB();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Server started`, { port: PORT });
    });
  } catch (err) {
    logger.error('Failed to start server', { 
      error: err.message,
      stack: err.stack,  // add this line
    });
    process.exit(1);
  }
};

start();

export default app;


