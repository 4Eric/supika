const success = (res, data, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data
    });
};

const error = (res, message, statusCode = 400, code = 'BAD_REQUEST') => {
    return res.status(statusCode).json({
        success: false,
        message,
        code
    });
};

const paginated = (res, data, total, page, limit) => {
    return res.status(200).json({
        success: true,
        data,
        meta: {
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        }
    });
};

module.exports = {
    success,
    error,
    paginated
};
