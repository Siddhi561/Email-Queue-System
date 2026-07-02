const asynHandler = (fn) => (res, req, next) => {
    Promise.resolve(fn(res, req, next)).catch(next);
};

export default asynHandler;