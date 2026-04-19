const { validationResult } = require('express-validator');
const { errorResponse } = require('../lib/response');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 'Validation failed', 422, errors.array());
  }
  next();
}

module.exports = { validate };
