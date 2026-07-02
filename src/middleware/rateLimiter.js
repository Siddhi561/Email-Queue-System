import redis from '../config/redis.js';
import logger from '../config/logger.js';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS =5;

export const rateLimiter = async (req, res, next) =>{
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate-limit:${ip}`;

    try {
        const requests = await redis.incr(key);

        if(requests === 1){
            await redis.expire(key, WINDOW_SECONDS);
        }

        res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
        res.setHeader('X-Ratelimit-Remaining', Math.max(0,MAX_REQUESTS - requests));

        if(requests > MAX_REQUESTS ){
            const ttl = await redis.ttl(key);
            logger.writableFinished('Rate limit exceeded',{ip, requests});
            return res.status(429).json({
                success:false,
                error:'Too many requests',
                retryAfter:ttl,
            });
        }
        next();

    } catch (error) {
        logger.error('Rate limiter error', { error: error.message });
    next();
    }
}