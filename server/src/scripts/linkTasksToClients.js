// Links tasks created before the client database existed to a client record, so
// they show up in that client's servicing history. A task is linked only when
// its title matches exactly one client's name (ignoring case and spacing):
//   - several clients with that name (the same client under different vendors)
//     are ambiguous, so those tasks are left alone and listed;
//   - tasks whose title matches no client are left alone.
// Safe to re-run — tasks that already have a client are never touched.
//
// Dry run by default (prints what it WOULD link); pass --apply to write:
//   npm run link:tasks-to-clients            # preview
//   npm run link:tasks-to-clients -- --apply # write
require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Task = require('../models/Task');

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

async function linkTasksToClients({ apply = false } = {}) {
  const clients = await Client.find().lean();
  const byName = new Map();
  for (const c of clients) {
    const key = norm(c.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(c);
  }

  const unlinked = await Task.find({ $or: [{ client: { $exists: false } }, { client: null }] }, 'title').lean();

  const plan = new Map(); // client id -> [task ids]
  const ambiguous = new Map(); // title -> number of tasks
  let unmatched = 0;

  for (const t of unlinked) {
    const matches = byName.get(norm(t.title)) || [];
    if (matches.length === 1) {
      const id = String(matches[0]._id);
      if (!plan.has(id)) plan.set(id, []);
      plan.get(id).push(t._id);
    } else if (matches.length > 1) {
      ambiguous.set(t.title, (ambiguous.get(t.title) || 0) + 1);
    } else {
      unmatched++;
    }
  }

  let linked = 0;
  for (const [clientId, taskIds] of plan) {
    linked += taskIds.length;
    if (apply) {
      const client = clients.find((c) => String(c._id) === clientId);
      // Title is rewritten to the client's exact spelling so it matches the
      // rest of that client's tasks.
      await Task.updateMany({ _id: { $in: taskIds }, client: null }, { $set: { client: client._id, title: client.name } });
    }
  }

  return {
    [apply ? 'linked' : 'wouldLink']: linked,
    ambiguousLeftAlone: Object.fromEntries(ambiguous),
    noMatchingClient: unmatched,
  };
}

module.exports = { linkTasksToClients };

if (require.main === module) {
  (async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`${apply ? 'APPLYING' : 'DRY RUN (no changes)'} on db "${mongoose.connection.name}" @ ${mongoose.connection.host}`);
    console.log(JSON.stringify(await linkTasksToClients({ apply }), null, 2));
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
