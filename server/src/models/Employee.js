const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Which Role (and therefore which permission set, if any) this employee
    // has — see Role.js. Only a true Admin can assign/change this (enforced
    // in adminEmployee.controller.js), never delegable via a permission.
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    designation: { type: String, default: '' },
    department: { type: String, default: '' },
    phone: { type: String, default: '' },
    employeeId: { type: String, required: true, unique: true, trim: true },
    joinDate: { type: String, required: true }, // YYYY-MM-DD
    location: { type: String, default: '' },
    aadhaarNumber: { type: String, default: '' }, // 12 digits, stored without hyphens
    upiId: { type: String, default: '' }, // e.g. name@okhdfcbank — used for the salary "Pay Now" UPI deep link
    shiftStart: { type: String, default: '09:30' }, // HH:mm, IST
    isActive: { type: Boolean, default: true },
    salaryMonthly: { type: Number, default: 0 }, // gross monthly salary, INR
    paidLeavesPerMonth: { type: Number, default: 0 }, // absences within this count aren't deducted from pay
    tokenVersion: { type: Number, default: 0 }, // bumped on password reset to invalidate existing JWTs
  },
  { timestamps: true },
);

module.exports = mongoose.model('Employee', employeeSchema);
