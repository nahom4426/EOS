const jwt = require('jsonwebtoken');

/**
 * Verify JWT and attach decoded user to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, branch_id, full_name, first_child_id?, mini_admin_id? }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Allow only specified roles.
 * Usage: requireRole('admin', 'superadmin')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  next();
};

/**
 * Admin-tier roles (formerly branch_admin).
 * Convenience alias for requireRole('admin', 'superadmin').
 */
const requireAdmin = requireRole('admin', 'superadmin');

/**
 * Any staff role (admin, mini_admin, first_child, superadmin) but NOT plain member.
 */
const requireStaff = requireRole('superadmin', 'admin', 'mini_admin', 'first_child');

/**
 * Ensure a branch-scoped role can only access their own branch.
 * Looks for branch_id in req.query, req.body, or route params.
 * superadmin and admin both bypass this check.
 */
const requireSameBranch = (req, res, next) => {
  // superadmin and admin can access any branch
  if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();
  const requestedBranch =
    req.params.branchId ||
    req.query.branch_id ||
    req.body.branch_id;
  if (requestedBranch && parseInt(requestedBranch) !== req.user.branch_id) {
    return res.status(403).json({ error: 'Forbidden: cross-branch access denied' });
  }
  next();
};

module.exports = { authenticate, requireRole, requireAdmin, requireStaff, requireSameBranch };
