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
    req.user = decoded; // { id, role, branch_id, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Allow only specified roles
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role' });
  }
  next();
};

/**
 * Ensure a branch_admin can only access their own branch.
 * Looks for branch_id in req.query, req.body, or route params.
 */
const requireSameBranch = (req, res, next) => {
  if (req.user.role === 'superadmin') return next(); // superadmin bypasses
  const requestedBranch =
    req.params.branchId ||
    req.query.branch_id ||
    req.body.branch_id;
  if (requestedBranch && parseInt(requestedBranch) !== req.user.branch_id) {
    return res.status(403).json({ error: 'Forbidden: cross-branch access denied' });
  }
  next();
};

module.exports = { authenticate, requireRole, requireSameBranch };
