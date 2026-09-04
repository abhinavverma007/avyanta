// Owner-only CLI to manage the master employee list directly in MongoDB.
// Run from the server/ directory, e.g.:
//   npm run manage:employees -- add --name "Rahul Sharma" --email rahul.sharma@sundesh.in \
//     --password "TempPass123!" --employeeId SD-0001 --designation "Senior Solar Technician" \
//     --department Operations --phone "+91 98765 43210" --joinDate 2021-04-15 --location "Jaipur, Rajasthan"
//   npm run manage:employees -- list
//   npm run manage:employees -- reset-password --email rahul.sharma@sundesh.in --password "NewPass123!"
//   npm run manage:employees -- deactivate --email rahul.sharma@sundesh.in
//   npm run manage:employees -- activate --email rahul.sharma@sundesh.in

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      const value = next && !next.startsWith('--') ? argv[++i] : true;
      args[key] = value;
    }
  }
  return args;
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  await mongoose.connect(process.env.MONGODB_URI);

  switch (command) {
    case 'add': {
      for (const key of ['name', 'email', 'password', 'employeeId', 'joinDate']) {
        if (!args[key]) throw new Error(`--${key} is required`);
      }
      const passwordHash = await bcrypt.hash(String(args.password), 10);
      const employee = await Employee.create({
        name: args.name,
        email: String(args.email).toLowerCase().trim(),
        passwordHash,
        employeeId: args.employeeId,
        designation: args.designation || '',
        department: args.department || '',
        phone: args.phone || '',
        joinDate: args.joinDate,
        location: args.location || '',
        aadhaarNumber: args.aadhaarNumber ? String(args.aadhaarNumber).replace(/\D/g, '') : '',
        shiftStart: args.shiftStart || '09:30',
      });
      console.log(`Created employee ${employee.employeeId} (${employee.email})`);
      break;
    }

    case 'list': {
      const employees = await Employee.find().sort({ createdAt: 1 });
      for (const e of employees) {
        console.log(`${e.employeeId}\t${e.name}\t${e.email}\t${e.isActive ? 'active' : 'inactive'}`);
      }
      break;
    }

    case 'reset-password': {
      if (!args.email || !args.password) throw new Error('--email and --password are required');
      const passwordHash = await bcrypt.hash(String(args.password), 10);
      const result = await Employee.findOneAndUpdate(
        { email: String(args.email).toLowerCase().trim() },
        { passwordHash, $inc: { tokenVersion: 1 } },
      );
      if (!result) throw new Error('Employee not found');
      console.log(`Password reset for ${args.email} (any existing session is now invalidated)`);
      break;
    }

    case 'deactivate':
    case 'activate': {
      if (!args.email) throw new Error('--email is required');
      const isActive = command === 'activate';
      const result = await Employee.findOneAndUpdate(
        { email: String(args.email).toLowerCase().trim() },
        { isActive },
      );
      if (!result) throw new Error('Employee not found');
      console.log(`${args.email} is now ${isActive ? 'active' : 'inactive'}`);
      break;
    }

    default:
      console.log('Usage: npm run manage:employees -- <add|list|reset-password|activate|deactivate> [--options]');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
