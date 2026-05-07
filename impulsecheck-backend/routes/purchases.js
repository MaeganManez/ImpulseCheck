const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const {
  savePurchase, getPurchases,
  deletePurchase, clearAllPurchases,
  getReport,
} = require('../controllers/purchaseController');

router.get('/',         auth, getPurchases);
router.post('/',        auth, savePurchase);
router.get('/report',   auth, getReport);
router.delete('/clear', auth, clearAllPurchases);
router.delete('/:id',   auth, deletePurchase);

module.exports = router;
