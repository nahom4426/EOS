const pool = require('../db/pool');
const geoip = require('geoip-lite');

/**
 * Logs a system audit event.
 * @param {Object} req Express request object containing user context
 * @param {string} action Action identifier (e.g., 'CREATE_CONTRIBUTION', 'UPDATE_MEMBER')
 * @param {string} entityType Entity name (e.g., 'contribution', 'user', 'branch')
 * @param {number|string|null} entityId Entity ID
 * @param {Object|string|null} details Additional metadata or JSON details
 */
async function logAudit(req, action, entityType = null, entityId = null, details = null) {
  try {
    const user = req?.user || {};
    const userId = user.id || null;
    const userName = user.full_name || user.phone || 'System';
    const userRole = user.role || 'system';
    const branchId = user.branch_id || null;
    let ipAddress = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '127.0.0.1';
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      ipAddress = '127.0.0.1';
    } else if (ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.replace('::ffff:', '');
    }

    // Determine location from header or GeoIP lookup
    let location = req?.headers?.['x-client-location'] || null;
    if (!location) {
      if (ipAddress === '127.0.0.1' || ipAddress === 'localhost' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
        location = 'Local Network (Development)';
      } else {
        const geo = geoip.lookup(ipAddress);
        if (geo) {
          const parts = [geo.city, geo.region, geo.country].filter(Boolean);
          location = parts.length ? parts.join(', ') : 'Unknown Location';
        } else {
          location = 'Unknown Location';
        }
      }
    }

    const detailsJson = typeof details === 'object' && details !== null
      ? JSON.stringify(details)
      : (details ? String(details) : null);

    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, branch_id, action, entity_type, entity_id, details, ip_address, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, userName, userRole, branchId, action, entityType, entityId, detailsJson, ipAddress, location]
    );
  } catch (err) {
    console.error('Audit log creation failed:', err.message);
  }
}

module.exports = { logAudit };
