const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { updateProfile, updatePreferences } = require('../controllers/profileController');

router.put('/',             auth, updateProfile);
router.put('/preferences',  auth, updatePreferences);

module.exports = router;
