const mongoose = require('mongoose');

// A tiny key/value store for settings the system itself decides and remembers (for example
// the date the "no daily report = absent" rule starts). One document per key.
const systemSettingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
