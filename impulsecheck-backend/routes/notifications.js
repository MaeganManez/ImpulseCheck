const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getNotifications, markAllRead, markOneRead } = require('../controllers/notificationController');

router.get('/',              auth, getNotifications);
router.put('/read-all',      auth, markAllRead);
router.put('/:id/read',      auth, markOneRead);

module.exports = router;
