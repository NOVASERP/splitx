// routes/expenseRoutes.js (Updated)
const express = require('express');
const { addExpense, getGroupExpenses, getUserExpenses } = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/add', protect, addExpense);
router.get('/group/:groupId/:month/:year', protect, getGroupExpenses);
router.get('/user/:groupId/:memberId/:month/:year', protect, getUserExpenses); // Yah naya route hai

module.exports = router;