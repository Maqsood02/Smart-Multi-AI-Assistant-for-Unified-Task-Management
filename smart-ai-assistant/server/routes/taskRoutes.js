const router    = require('express').Router();
const taskCtrl  = require('../controllers/taskController');
const auth      = require('../middleware/authMiddleware');

router.get('/',        auth, taskCtrl.getAll);
router.post('/',       auth, taskCtrl.create);
router.put('/:id',     auth, taskCtrl.update);
router.patch('/:id/toggle', auth, taskCtrl.toggle);
router.delete('/:id',  auth, taskCtrl.remove);

module.exports = router;
