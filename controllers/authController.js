// controllers/authController.js

const User = require('../models/User');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');
const cloudinary = require('cloudinary').v2;

// Cloudinary configuration (make sure your .env file has these)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const sendEmail = async (email, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text,
  };
  await transporter.sendMail(mailOptions);
};

const sendOtp = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const otp = randomstring.generate({ length: 6, charset: 'numeric' });
    await Otp.create({ email, otp });

    await sendEmail(email, 'Your OTP for Expense Tracker', `Your OTP is: ${otp}`);

    res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyOtpAndRegister = async (req, res) => {
  const { email, otp, name, password } = req.body;
  try {
    const otpDoc = await Otp.findOne({ email, otp });
    if (!otpDoc) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    const user = new User({ name, email, password });
    await user.save();
    await Otp.deleteMany({ email });

    res.status(201).json({ message: 'User registered successfully', memberId: user.memberId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const authUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const isMatch = await user.matchPassword(password);
    if (isMatch) {
      res.json({
        message: 'Login successful',
        memberId: user.memberId,
        token: generateToken(user._id),
        name: user.name,
        avatarUrl: user.avatarUrl,
          _id: user._id,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const findUserByMemberId = async (req, res) => {
  const { memberId } = req.params;
  try {
    const user = await User.findOne({ memberId }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ _id: user._id, name: user.name, memberId: user.memberId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  const { name } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (name) {
      user.name = name;
    }
    
    await user.save();
    res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
};

// NEW: Function to upload user avatar
const uploadAvatar = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'user-avatars',
      resource_type: 'image'
    });

    user.avatarUrl = result.secure_url;
    await user.save();

    res.status(200).json({
      message: 'Avatar updated successfully.',
      avatarUrl: user.avatarUrl, // This line is the crucial fix
    });

  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Failed to upload avatar.' });
  }
};
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      memberId: user.memberId
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
};
// ... (आपके मौजूदा फ़ंक्शन जैसे कि sendOtp, verifyOtpAndRegister, authUser, आदि)

// NEW: Forgot Password functionality
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const otp = randomstring.generate({ length: 6, charset: 'numeric' });

        // पुराने OTP को हटा दें और नया OTP बनाएं
        await Otp.deleteMany({ email });
        await Otp.create({ email, otp });

        const subject = 'Password Reset OTP for Expense Tracker';
        const text = `Hello ${user.name},\n\nYour OTP to reset your password is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request a password reset, please ignore this email.`;

        await sendEmail(email, subject, text);

        res.status(200).json({ message: 'Password reset OTP sent to your email.' });
    } catch (error) {
        console.error('Error in forgotPassword:', error);
        res.status(500).json({ message: 'Failed to send OTP. Please try again later.' });
    }
};

const verifyPasswordOtp = async (req, res) => {
    const { email, otp } = req.body;
    try {
        const otpDoc = await Otp.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }
        // OTP सही है, हम इसे बाद में इस्तेमाल होने से रोकने के लिए हटा सकते हैं
        await Otp.deleteOne({ email, otp });

        res.status(200).json({ message: 'OTP verified successfully. You can now reset your password.' });
    } catch (error) {
        console.error('Error in verifyPasswordOtp:', error);
        res.status(500).json({ message: 'An error occurred during verification.' });
    }
};

// controllers/authController.js

// controllers/authController.js

const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // --- यह बदलाव है ---
        // सीधे newPassword असाइन करें, pre('save') हुक इसे हैश कर देगा
        user.password = newPassword;
        
        await user.save(); // pre('save') हुक यहाँ चलेगा और पासवर्ड को हैश करेगा
        
        // एक बार पासवर्ड रीसेट होने के बाद, संबंधित OTP को हटा दें
        await Otp.deleteMany({ email });

        res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
        console.error('Error in resetPassword:', error);
        res.status(500).json({ message: 'Failed to reset password. Please try again later.' });
    }
};


module.exports = { 
  sendOtp, 
  verifyOtpAndRegister, 
  authUser, 
  findUserByMemberId,
  updateUserProfile,
  uploadAvatar,
  getUserProfile,
  forgotPassword, // <--- Add this new function
  verifyPasswordOtp, // <--- Add this new function
  resetPassword, // <--- Add this new function
};