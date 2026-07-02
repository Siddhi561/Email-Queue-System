import {z} from 'zod';

export const emailJobSchema = z.object({
    to: z.string().email('Invailed email address'),
    subject: z.string().min(1,'Subject is required').max(200,'Subject too long'),
    body: z.string().min(1,'Body is rquired'),
     priority: z.number().int().min(1).max(10).optional(),
});

//middleware factory -  pass this in schema, it returns a middleware
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if(!result.success){
        throw result.error;
    }

    req.body = result.data;
    next();
};

export default validate;