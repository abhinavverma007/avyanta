// Bootstrap superadmin (owner) accounts directly in MongoDB — there is no
// public admin signup, so at least one of these must exist before /superadmin
// can be used. Run from the server/ directory, e.g.:
//   npm run manage:admins -- add --name "Abhinav Verma" --email owner@sundesh.in --password "StrongPass123!"
//   npm run manage:admins -- list
//   npm run manage:admins -- reset-password --email owner@sundesh.in --password "NewPass123!"

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

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
      for (const key of ['name', 'email', 'password']) {
        if (!args[key]) throw new Error(`--${key} is required`);
      }
      const passwordHash = await bcrypt.hash(String(args.password), 10);
      const admin = await Admin.create({
        name: args.name,
        email: String(args.email).toLowerCase().trim(),
        passwordHash,
      });
      console.log(`Created admin ${admin.email}`);
      break;
    }

    case 'list': {
      const admins = await Admin.find().sort({ createdAt: 1 });
      for (const a of admins) console.log(`${a.name}\t${a.email}`);
      break;
    }

    case 'reset-password': {
      if (!args.email || !args.password) throw new Error('--email and --password are required');
      const passwordHash = await bcrypt.hash(String(args.password), 10);
      const result = await Admin.findOneAndUpdate(
        { email: String(args.email).toLowerCase().trim() },
        { passwordHash, $inc: { tokenVersion: 1 } },
      );
      if (!result) throw new Error('Admin not found');
      console.log(`Password reset for ${args.email} (any existing session is now invalidated)`);
      break;
    }

    default:
      console.log('Usage: npm run manage:admins -- <add|list|reset-password> [--options]');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
