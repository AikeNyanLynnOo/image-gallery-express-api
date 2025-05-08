const express = require('express');
const router = express.Router();
const { sendVerification, verifyEmail } = require('../controllers/verificationController');

router.post('/', sendVerification);
router.get('/:token', verifyEmail);

module.exports = router; 