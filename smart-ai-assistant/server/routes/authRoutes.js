const router    = require('express').Router();
const authCtrl  = require('../controllers/authController');

router.post('/register', authCtrl.register);
router.post('/login',    authCtrl.login);
router.post('/logout',   authCtrl.logout);
router.get('/me',        require('../middleware/authMiddleware'), authCtrl.me);

module.exports = router;
