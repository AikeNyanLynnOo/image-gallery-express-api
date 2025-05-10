const express = require('express');
const router = express.Router();
const { signUp, signIn, logout, refreshToken } = require('../controllers/authController');
const { validateSignup } = require('../middleware/validation');

router.post('/signup', validateSignup, signUp);
router.post('/signin', signIn);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);

module.exports = router; 