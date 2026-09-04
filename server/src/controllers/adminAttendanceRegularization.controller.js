const AttendanceRegularization = require('../models/AttendanceRegularization');
const Attendance = require('../models/Attendance');
const { sanitize } = require('./attendanceRegularization.controller');
const { istToDate } = require('../utils/istDate');

function shiftStartMinutes(shiftStart) {
  const [h, m] = (shiftStart || '09:30').split(':').map(Number);
  return h * 60 + m;
}

function withEmployee(request) {
  return {
    ...sanitize(request),
    employee: request.employee
      ? {
          id: request.employee._id.toString(),
          name: request.employee.name,
          employeeId: request.employee.employeeId,
          department: request.employee.department,
        }
      : null,
  };
}

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const requests = await AttendanceRegularization.find(filter)
    .populate('employee', 'name employeeId department shiftStart')
    .sort({ createdAt: -1 });

  res.json({ requests: requests.map(withEmployee) });
};

exports.review = (status) => async (req, res) => {
  const request = await AttendanceRegularization.findById(req.params.id).populate('employee', 'name employeeId department shiftStart');
  if (!request) return res.status(404).json({ message: 'Regularization request not found.' });
  if (request.status !== 'pending') {
    return res.status(409).json({ message: `Request already ${request.status}.` });
  }

  if (status === 'approved') {
    const checkIn = istToDate(request.date, request.requestedCheckIn);
    const checkOut = istToDate(request.date, request.requestedCheckOut);
    const [h, m] = request.requestedCheckIn.split(':').map(Number);
    const lateBy = Math.max(0, h * 60 + m - shiftStartMinutes(request.employee?.shiftStart));

    await Attendance.findOneAndUpdate(
      { employee: request.employee._id, date: request.date },
      { $set: { status: 'present', sessions: [{ checkIn, checkOut }], lateBy } },
      { upsert: true },
    );
  }

  request.status = status;
  request.reviewNote = req.body.reviewNote || '';
  request.reviewedAt = new Date();
  await request.save();

  res.json({ request: withEmployee(request) });
};
