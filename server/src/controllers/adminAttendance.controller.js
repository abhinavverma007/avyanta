const Employee = require('../models/Employee');
const { computeMonthlyAttendance } = require('../utils/attendanceStats');
const { istNow } = require('../utils/istDate');

exports.monthly = async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  const now = istNow();
  const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
  const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

  const data = await computeMonthlyAttendance(employee, year, month);
  res.json({
    ...data,
    employee: {
      id: employee._id.toString(),
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
    },
  });
};
