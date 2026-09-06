// Blocks a delegated Supervisor/Manager from approving/rejecting a request
// that's their own — a conflict-of-interest guard on top of the existing
// permission check. req.admin/req.employee are set by requirePermission.js;
// req.employee is never set for a true Admin call, so this is always a
// no-op for the owner, who can review anyone's request including their own
// delegated Supervisors'.
function rejectSelfReview(req, res, resourceEmployeeId) {
  if (req.employee && String(resourceEmployeeId) === String(req.employee._id)) {
    res.status(403).json({ message: "You can't approve or reject your own request — ask the owner to review it." });
    return true;
  }
  return false;
}

module.exports = { rejectSelfReview };
