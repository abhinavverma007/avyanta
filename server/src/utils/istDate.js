const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// India has no DST, so shifting the epoch and reading UTC components back
// off it gives IST wall-clock values without needing a timezone database.
function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function istDateString(d = istNow()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function istMinutesSinceMidnight(d = istNow()) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function istHHMM(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  const m = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Inverse of istHHMM/istDateString — builds the real stored instant for a
// given IST calendar day + wall-clock time (e.g. for a superadmin-approved
// attendance regularization, where there's no live punch to record from).
function istToDate(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min, 0) - IST_OFFSET_MS);
}

module.exports = { istNow, istDateString, istMinutesSinceMidnight, istHHMM, istToDate };
