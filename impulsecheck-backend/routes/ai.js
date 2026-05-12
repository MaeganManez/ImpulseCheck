const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { analyzePurchase } = require('../controllers/aiController');
const { scanProduct }     = require('../controllers/aiVisionController');

router.post('/analyze',       auth, analyzePurchase);
router.post('/scan-product',  auth, scanProduct);

module.exports = router;
