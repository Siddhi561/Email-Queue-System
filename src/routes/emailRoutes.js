import {Router} from 'express';
import validate from '../middleware/validate.js';
import { emailJobSchema } from '../middleware/validate.js';
import { sendEmail, getEmailStatus } from '../controller/email.controller.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router= Router();

router.post ('/send', rateLimiter, validate(emailJobSchema), sendEmail);

router.get('/status/:jobId', getEmailStatus);

export default router;