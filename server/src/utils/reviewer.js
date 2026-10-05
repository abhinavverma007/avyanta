// Who is reviewing (approving/rejecting) a request — the owner, or a
// delegated Supervisor/Manager. req.admin / req.employee are set by
// requirePermission.js; exactly one of them is present on a review route.
function reviewerStamp(req) {
  const actor = req.admin || req.employee;
  return {
    id: actor._id,
    name: actor.name,
    actorType: req.admin ? 'admin' : 'employee',
  };
}

module.exports = { reviewerStamp };
