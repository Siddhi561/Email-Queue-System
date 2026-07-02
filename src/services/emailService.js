import { Resend } from 'resend';
import logger from '../config/logger.js';

// console.log('RESEND KEY:', process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, body }) => {
    logger.info('Sending email', { to, subject });

    const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to,
        subject,
        html: `<p>${body}</p>`,
    });

    if (error) {
        // throw for worker to trigger retry logic
        logger.error('Resend API Error', { error: error.message, to });
        throw new Error(`Email send failed: ${error.message}`);
    }

    logger.info('Email sent successfully', { messageId: data.id, to });

    return data;

}