const Reimbursement = require('../models/Reimbursement');
const { sanitize } = require('./reimbursement.controller');

function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

function withEmployee(claim) {
  return {
    ...sanitize(claim),
    employee: claim.employee
      ? {
          id: claim.employee._id.toString(),
          name: claim.employee.name,
          employeeId: claim.employee.employeeId,
          department: claim.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.year && req.query.month) {
    const { start, end } = monthRange(req.query.year, req.query.month);
    filter.date = { $gte: start, $lte: end };
  }

  const claims = await Reimbursement.find(filter)
    .populate('employee', 'name employeeId department')
    .sort({ createdAt: -1 });

  res.json({ claims: claims.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const claim = await Reimbursement.findById(req.params.id).populate('employee', 'name employeeId department');
  if (!claim) return res.status(404).json({ message: 'Claim not found.' });
  if (claim.status !== 'pending') {
    return res.status(409).json({ message: `Claim already ${claim.status}.` });
  }

  claim.status = status;
  claim.reviewNote = req.body.reviewNote || '';
  claim.reviewedAt = new Date();
  await claim.save();

  res.json({ claim: withEmployee(claim) });
};
