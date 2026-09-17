const pool = require('../db/pool');

/**
 * Calculates member consistency score (0-100), streak, and badge tier.
 * @param {number} memberId
 * @returns {Promise<{ score: number, tier: string, tierBadge: string, tierColor: string, streakMonths: number, monthsPaidCount: number }>}
 */
async function calculateMemberScore(memberId) {
  try {
    const result = await pool.query(
      `SELECT month_covered, amount, date_paid 
       FROM contributions 
       WHERE member_id = $1 
       ORDER BY month_covered DESC`,
      [memberId]
    );

    const rows = result.rows;
    if (rows.length === 0) {
      return {
        score: 10,
        tier: 'Bronze',
        tierBadge: '🥉',
        tierColor: '#cd7f32',
        streakMonths: 0,
        monthsPaidCount: 0,
        totalContributed: 0
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1 - 12

    // Past 12 months set
    const past12Months = new Set();
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      past12Months.add(`${yyyy}-${mm}-01`);
    }

    const paidMonthSet = new Set();
    let totalContributed = 0;

    rows.forEach(r => {
      const monthStr = typeof r.month_covered === 'string'
        ? r.month_covered.slice(0, 10)
        : r.month_covered.toISOString().slice(0, 10);
      paidMonthSet.add(monthStr);
      totalContributed += parseFloat(r.amount || 0);
    });

    let monthsPaidInPast12 = 0;
    past12Months.forEach(m => {
      if (paidMonthSet.has(m)) monthsPaidInPast12++;
    });

    // Calculate consecutive monthly streak backwards from current month or last month
    let streakMonths = 0;
    let checkDate = new Date(currentYear, currentMonth - 1, 1);
    
    // Check if current month is paid, if not check if last month is paid to count active streak
    let checkMonthStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-01`;
    if (!paidMonthSet.has(checkMonthStr)) {
      // Step back 1 month
      checkDate.setMonth(checkDate.getMonth() - 1);
      checkMonthStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-01`;
    }

    while (paidMonthSet.has(checkMonthStr)) {
      streakMonths++;
      checkDate.setMonth(checkDate.getMonth() - 1);
      checkMonthStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-01`;
    }

    // Scoring math
    // 1. Consistency (max 50 points): proportion of past 12 months paid
    const consistencyScore = (monthsPaidInPast12 / 12) * 50;

    // 2. Streak bonus (max 30 points): 5 pts per streak month
    const streakScore = Math.min(30, streakMonths * 5);

    // 3. Activity tenure & volume (max 20 points)
    const activityScore = Math.min(20, rows.length * 2);

    const rawScore = Math.round(consistencyScore + streakScore + activityScore);
    const score = Math.max(10, Math.min(100, rawScore));

    let tier = 'Bronze';
    let tierBadge = '🥉';
    let tierColor = '#cd7f32';

    if (score >= 90) {
      tier = 'Platinum';
      tierBadge = '🏆';
      tierColor = '#8a2be2';
    } else if (score >= 75) {
      tier = 'Gold';
      tierBadge = '🥇';
      tierColor = '#d4af37';
    } else if (score >= 50) {
      tier = 'Silver';
      tierBadge = '🥈';
      tierColor = '#718096';
    }

    return {
      score,
      tier,
      tierBadge,
      tierColor,
      streakMonths,
      monthsPaidCount: monthsPaidInPast12,
      totalContributed
    };
  } catch (err) {
    console.error('Error calculating member score:', err);
    return {
      score: 50,
      tier: 'Silver',
      tierBadge: '🥈',
      tierColor: '#718096',
      streakMonths: 0,
      monthsPaidCount: 0,
      totalContributed: 0
    };
  }
}

module.exports = { calculateMemberScore };
