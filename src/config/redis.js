import Redis from 'ioredis';
import logger from './logger.js';

const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times){
        const delay = Math.min(times*50, 2000);
        return delay;
    }
});

redis.on('connect', () => {
    logger.info('Connected to Redis');
})

redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message});
});

export default redis;