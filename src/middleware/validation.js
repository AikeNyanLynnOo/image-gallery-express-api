const { body, validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

const validateSignup = [
  // First name validation
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must not exceed 50 characters'),

  // Last name validation
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name must not exceed 50 characters'),

  // Email validation
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .isLength({ min: 5, max: 100 })
    .withMessage('Email must be between 5 and 100 characters'),

  // Password validation with separate messages for each criteria
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .isLength({ max: 100 })
    .withMessage('Password must not exceed 100 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&]/)
    .withMessage('Password must contain at least one special character (@$!%*?&)')
    .not()
    .matches(/^$|\s+/)
    .withMessage('Password must not contain whitespace'),

  // Validation result middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ApiResponse.validationError(errors)
      );
    }
    next();
  }
];

module.exports = {
  validateSignup
}; 