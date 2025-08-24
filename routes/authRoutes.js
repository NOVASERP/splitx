// routes/authRoutes.js
const User = require("../models/User");
const express = require('express');
const {
  sendOtp,
  verifyOtpAndRegister,
  authUser,
  findUserByMemberId,
  updateUserProfile,
  uploadAvatar,
  getUserProfile,
  forgotPassword,
  verifyPasswordOtp,
  resetPassword
} = require('../controllers/authController');



const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Multer setup for file uploads
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/* ------------------- AUTH ROUTES ------------------- */
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtpAndRegister);
router.post('/login', authUser);

/* ------------------- USER ROUTES ------------------- */
router.get('/users/:memberId', findUserByMemberId);

router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/profile/avatar', protect, upload.single('avatar'), uploadAvatar);

router.post('/forgot-password', forgotPassword);
router.post('/verify-password-otp', verifyPasswordOtp);
router.post('/reset-password', resetPassword);

router.post("/update-token", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.fcmToken = req.body.fcmToken;
    await user.save();

    res.json({ message: "Token updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
