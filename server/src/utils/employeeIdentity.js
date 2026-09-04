const Employee = require('../models/Employee');
const Counter = require('../models/Counter');

function slugifyName(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
}

// firstname.lastname@sundesh.in, with a numeric suffix appended only if that
// exact address is already taken (two employees can share a name).
async function generateUniqueEmail(name) {
  const base = slugifyName(name) || 'employee';
  let candidate = `${base}@sundesh.in`;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Employee.findOne({ email: candidate })) {
    candidate = `${base}${suffix}@sundesh.in`;
    suffix += 1;
  }
  return candidate;
}

// Atomic — safe even if two employees are created at the same moment.
async function generateEmployeeId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'employeeId' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `SD-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { slugifyName, generateUniqueEmail, generateEmployeeId };
