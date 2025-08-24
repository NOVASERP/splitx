const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const admin = require("firebase-admin");

// ---------------- ADD EXPENSE ----------------
const addExpense = async (req, res) => {
  const { amount, description, groupId } = req.body;
  const spentBy = req.user._id;

  try {
    // 1️⃣ Expense Save
    const newExpense = new Expense({
      amount,
      description,
      group: groupId,
      spentBy,
    });
    await newExpense.save();

    // 2️⃣ Group + Members fetch karo
    const group = await Group.findById(groupId).populate("members", "name fcmToken");
    const spender = await User.findById(spentBy);

    // 3️⃣ Notification bhejo sab members ko (spender ko chod ke)
    if (group) {
      const tokens = group.members
        .filter(m => m._id.toString() !== spentBy.toString()) // khud ko mat bhejna
        .map(m => m.fcmToken)
        .filter(Boolean);

      if (tokens.length > 0) {
        const message = {
          notification: {
            title: `💰 New Expense in ${group.name}`,
            body: `${spender.name} added ₹${amount} - ${description}`,
          },
          tokens,
        };

        try {
          const response = await admin.messaging().sendMulticast(message);
          console.log("✅ Notifications sent:", response.successCount);
        } catch (err) {
          console.error("❌ Error sending notification:", err);
        }
      }
    }

    res.status(201).json({
      message: 'Expense added successfully',
      expense: newExpense,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------- GROUP EXPENSES ----------------
const getGroupExpenses = async (req, res) => {
  const { groupId, month, year } = req.params;
  const userId = req.user._id;

  try {
    const group = await Group.findById(groupId);

    if (!group || !group.members.includes(userId)) {
      return res.status(404).json({ message: 'Group not found or you are not a member' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const expenses = await Expense.find({
      group: groupId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate('spentBy', 'name');

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------- USER EXPENSES ----------------
const getUserExpenses = async (req, res) => {
  const { groupId, memberId, month, year } = req.params;
  const userId = req.user._id;
  
  try {
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(userId)) {
      return res.status(404).json({ message: 'Group not found or you are not a member' });
    }
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const expenses = await Expense.find({
      group: groupId,
      spentBy: memberId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).populate('spentBy', 'name');

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addExpense, getGroupExpenses, getUserExpenses };
