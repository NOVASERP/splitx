// models/Otp.js
const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // OTP 5 मिनट बाद एक्सपायर हो जाएगा
  },
});

const Otp = mongoose.model('Otp', OtpSchema);
module.exports = Otp;