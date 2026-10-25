const mongoose = require('mongoose');

// A recorded fact — "the owner paid this much, for this employee, for this
// month" — separate from `payable`, which is always a live-recomputed
// figure. Multiple payouts can exist for the same employee+month (e.g. a
// late-approved regularization bumps what's owed after an initial payment
// already went out); the salary controller sums them and nets against the
// current payable to get a balance, the same way a Splitwise settlement
// nets against a running balance instead of overwriting it.
const payoutSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12
    // 0 is allowed only for a payment that carries the whole amount to next month (see carryForward).
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true },
    note: { type: String, default: '' },
    // Set only when the owner paid a custom amount instead of the full balance. What was
    // left over after this payment, carried into the NEXT month's balance: positive = still
    // owed to the employee (paid less than the balance), negative = paid more than was owed
    // (to be recovered from next month). Absent/0 on every normal payout — i.e. every
    // payout that exists today — so those behave exactly as before.
    carryForward: { type: Number, default: 0 },
  },
  { timestamps: true },
);

payoutSchema.index({ employee: 1, year: 1, month: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
