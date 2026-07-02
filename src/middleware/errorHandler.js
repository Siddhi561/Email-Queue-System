import logger from '../config/logger.js';

const errorHandler = (err, req, res, next) =>{
    logger.error('Unhandled error',{
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    
    //Zod error
    if(err.name === 'ZodError'){
        return res.status(400).json({
            success:false,
            errror: 'Validation failed',
            issues: err.errors.map(e =>({
                field:e.path.join('.'),
                message:e.message,
            })),
        });
    }

    //operational error
    if(err.statusCode){
        return res.status(err.statusCode).json({
            success:false,
            error: err.message,
        });
    }


    //unknow error
    res.status(500).json({
        success:false,
        error:'Internal Server error',
    });

};

export default errorHandler;