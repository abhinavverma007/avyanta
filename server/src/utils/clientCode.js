const Client = require('../models/Client');
const Counter = require('../models/Counter');

// CD-0001, CD-0002, … — atomic, so two clients created at the same moment can never get
// the same number (same approach as utils/employeeIdentity.js's SD-0001 for employees).
async function generateClientCode() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'clientCode' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `CD-${String(counter.seq).padStart(4, '0')}`;
}

const MISSING = { $in: [null, ''] }; // matches a client that has no code stored at all

// Clients that existed before codes did get theirs here, in the order they were added
// (oldest = CD-0001), the first time anything asks for the client list — so there's no
// separate migration step to remember to run. Cheap when nothing is missing. Run one at a
// time within this process so two simultaneous first requests can't number the same
// clients in different orders; the conditional update below also keeps a second server
// process from ever overwriting a code that's already been given.
let chain = Promise.resolve();
async function assignMissingCodes() {
  const missing = await Client.find({ clientCode: MISSING }, '_id').sort({ createdAt: 1, _id: 1 }).lean();
  for (const c of missing) {
    const clientCode = await generateClientCode();
    await Client.updateOne({ _id: c._id, clientCode: MISSING }, { $set: { clientCode } });
  }
}
function ensureClientCodes() {
  const run = chain.then(assignMissingCodes);
  chain = run.catch(() => {});
  return run;
}

module.exports = { generateClientCode, ensureClientCodes };
