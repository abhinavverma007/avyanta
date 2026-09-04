const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 }, // bumped on password reset to invalidate existing JWTs
  },
  { timestamps: true },
);

module.exports = mongoose.model('Admin', adminSchema);
