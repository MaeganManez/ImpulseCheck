const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const { saveBudget, getBudget } = require('../controllers/budgetController');

router.get('/',  auth, getBudget);
router.post('/', auth, saveBudget);

module.exports = router;
