const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  register, verifyOTP, resendOTP,
  login, forgotPassword, resetPassword, getMe,
} = require('../controllers/authController');

router.post('/register',        register);
router.post('/verify-otp',      verifyOTP);
router.post('/resend-otp',      resendOTP);
router.post('/login',           login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.get('/me',               auth, getMe);

module.exports = router;
