const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sendReport } = require('../controllers/reportController');

router.post('/send', auth, sendReport);

module.exports = router;
