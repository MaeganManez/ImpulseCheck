const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { analyzePurchase } = require('../controllers/aiController');

router.post('/analyze', auth, analyzePurchase);

module.exports = router;
