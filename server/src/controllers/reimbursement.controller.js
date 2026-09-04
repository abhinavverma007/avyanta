const Reimbursement = require('../models/Reimbursement');

const CATEGORIES = ['petrol', 'food', 'travel', 'other'];

function sanitize(r) {
  return {
    id: r._id.toString(),
    category: r.category,
    amount: r.amount,
    description: r.description,
    date: r.date,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
  };
}

exports.create = async (req, res) => {
  const { category, amount, description, date } = req.body;
  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `category must be one of: ${CATEGORIES.join(', ')}.` });
  }
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'amount must be greater than 0.' });
  }
  if (!date) {
    return res.status(400).json({ message: 'date is required.' });
  }

  const claim = await Reimbursement.create({
    employee: req.employee._id,
    category,
    amount: Number(amount),
    description: description || '',
    date,
  });
  res.status(201).json({ claim: sanitize(claim) });
};

exports.mine = async (req, res) => {
  const claims = await Reimbursement.find({ employee: req.employee._id }).sort({ createdAt: -1 });
  res.json({ claims: claims.map(sanitize) });
};

exports.sanitize = sanitize;
