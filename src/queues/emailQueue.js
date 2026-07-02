import { Queue } from 'bullmq';
import redis from '../config/redis.js';
import logger from '../config/logger.js';

//defining the queue
const emailQueue = new Queue('email', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,  // retry failed jobs 3 times
        backoff: {
            type: 'exponential', // wait longer between each retry
            delay: 5000,           // first retry after 5s, then 25s, then 125s
        },
        removeOnComplete: { count: 100 },  //keep last 100 complete jobs in redis
      removeOnFail: { count: 500 },
    },
});
//dead letter queue
const deadLetterQueue =  new Queue('email-dead-letter', {
    connection: redis,
});




emailQueue.on('error', (err) => {
    logger.error('Email Queue Error:', { error: err.message });
});

export const addEmailJob = async (jobData, priority=10) => {
    const job = await emailQueue.add('send-email', jobData,{
        priority,  
    });
    logger.info('Email job added to queue', {
        jobId: job.id,
        to: jobData.to,
        priority 
    });
    return job;
}

// called by worker when job exhausts all retries
export const moveToDeadLetter = async (jobData, error) => {
  await deadLetterQueue.add('failed-email', {
    ...jobData,
    failedReason: error,
    failedAt: new Date().toISOString(),
  });
  logger.warn('Job moved to dead letter queue', { to: jobData.to, error });
};


export default emailQueue;
