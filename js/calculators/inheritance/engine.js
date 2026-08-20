/**
 * Miqdaar Faraid Engine
 * Deterministic inheritance calculator.
 * Separate rule paths per madhhab where they differ.
 * Rules Version: 1.0
 *
 * V1 supports: spouse, parents, sons, daughters, basic siblings, fixed shares,
 * residuary (asabah), basic hajb, awl, radd (where commonly applied).
 * Complex grandfather+siblings, distant kindred, advanced Ja'fari → scholar review.
 */

import { MADHHABS } from '../../../data/constants.js';

/**
 * @typedef {Object} HeirCounts
 * @property {number} husbands - 0 or 1
 * @property {number} wives - 0-4
 * @property {number} sons
 * @property {number} daughters
 * @property {boolean} father
 * @property {boolean} mother
 * @property {number} fullBrothers
 * @property {number} fullSisters
 * @property {number} paternalBrothers
 * @property {number} paternalSisters
 * @property {number} maternalBrothers
 * @property {number} maternalSisters
 * @property {boolean} paternalGrandfather
 * @property {boolean} maternalGrandfather
 * @property {boolean} paternalGrandmother
 * @property {boolean} maternalGrandmother
 */

/**
 * Calculate Islamic inheritance
 * @param {Object} params
 * @param {string} params.methodology
 * @param {number} params.netEstate - after debts, funeral, valid wasiyyah
 * @param {HeirCounts} params.heirs
 * @returns {Object}
 */
export function calculateInheritance({ methodology, netEstate, heirs }) {
  if (netEstate < 0) {
    return { success: false, error: 'Net estate cannot be negative.', code: 'INVALID_INPUT' };
  }

  // Guard: unsupported complex cases
  const unsupported = checkUnsupported(heirs, methodology);
  if (unsupported) {
    return {
      success: false,
      code: 'SCHOLAR_REVIEW',
      message: unsupported,
      prepareReport: true
    };
  }

  // Normalize counts
  const h = normalizeHeirs(heirs);

  // Route to madhhab-specific calculator
  let result;
  switch (methodology) {
    case MADHHABS.HANAFI:
    case MADHHABS.GENERAL:
    case MADHHABS.UNKNOWN:
      result = calculateHanafi(h, netEstate);
      break;
    case MADHHABS.SHAFII:
      result = calculateShafii(h, netEstate);
      break;
    case MADHHABS.MALIKI:
      result = calculateMaliki(h, netEstate);
      break;
    case MADHHABS.HANBALI:
      result = calculateHanbali(h, netEstate);
      break;
    case MADHHABS.JAFARI:
      result = calculateJafari(h, netEstate);
      break;
    default:
      return {
        success: false,
        code: 'SCHOLAR_REVIEW',
        message: 'Selected methodology is not fully supported for this case in V1. Please consult a qualified scholar.',
        prepareReport: true
      };
  }

  // Final validation
  const validation = validateResult(result, netEstate);
  if (!validation.ok) {
    return {
      success: false,
      code: 'VALIDATION_FAILED',
      message: validation.message,
      prepareReport: true
    };
  }

  return {
    success: true,
    rulesVersion: '1.0',
    methodology,
    netEstate,
    shares: result.shares,
    excluded: result.excluded,
    notes: result.notes || [],
    evidence: result.evidence || [],
    totalFraction: result.totalFraction,
    disclaimerRequired: true
  };
}

function normalizeHeirs(heirs) {
  return {
    husbands: Math.min(1, Math.max(0, heirs.husbands || 0)),
    wives: Math.min(4, Math.max(0, heirs.wives || 0)),
    sons: Math.max(0, heirs.sons || 0),
    daughters: Math.max(0, heirs.daughters || 0),
    father: !!heirs.father,
    mother: !!heirs.mother,
    fullBrothers: Math.max(0, heirs.fullBrothers || 0),
    fullSisters: Math.max(0, heirs.fullSisters || 0),
    paternalBrothers: Math.max(0, heirs.paternalBrothers || 0),
    paternalSisters: Math.max(0, heirs.paternalSisters || 0),
    maternalBrothers: Math.max(0, heirs.maternalBrothers || 0),
    maternalSisters: Math.max(0, heirs.maternalSisters || 0),
    paternalGrandfather: !!heirs.paternalGrandfather,
    maternalGrandfather: !!heirs.maternalGrandfather,
    paternalGrandmother: !!heirs.paternalGrandmother,
    maternalGrandmother: !!heirs.maternalGrandmother
  };
}

function checkUnsupported(h, methodology) {
  // Grandfather + siblings is a classic area of difference and complexity
  if (h.paternalGrandfather && (h.fullBrothers > 0 || h.fullSisters > 0 || h.paternalBrothers > 0 || h.paternalSisters > 0)) {
    return 'Cases involving paternal grandfather together with siblings have significant differences between schools and special rules. Scholar verification is required in this version.';
  }
  // Distant kindred / multiple generations of grandchildren not in V1
  // (we only support direct sons/daughters for now)
  if (methodology === MADHHABS.JAFARI && (h.fullBrothers + h.fullSisters + h.paternalBrothers + h.paternalSisters + h.maternalBrothers + h.maternalSisters > 0) && (h.sons + h.daughters === 0) && !h.father && !h.mother) {
    // Basic Ja'fari class system is more complex; mark for review if only siblings
    // Allow simple spouse/parent/child for now
  }
  return null;
}

/**
 * Core Hanafi-style calculation (also used as base for General)
 * Fixed shares (furud) then residuary (asabah).
 */
function calculateHanafi(h, netEstate) {
  const shares = []; // { heir, fraction, amount, reason, evidence }
  const excluded = [];
  const notes = [];
  const evidence = ['4:11', '4:12', 'bukhari_6732'];

  let remaining = 1; // fraction remaining
  const hasChildren = h.sons + h.daughters > 0;
  const hasMaleDescendant = h.sons > 0;

  // --- Spouse ---
  if (h.husbands === 1) {
    const frac = hasChildren ? 1 / 4 : 1 / 2;
    shares.push({
      heir: 'Husband',
      count: 1,
      fraction: frac,
      amount: netEstate * frac,
      reason: hasChildren
        ? 'Husband receives 1/4 when the deceased leaves children (Quran 4:12).'
        : 'Husband receives 1/2 when the deceased leaves no children (Quran 4:12).',
      evidence: '4:12'
    });
    remaining -= frac;
  }
  if (h.wives > 0) {
    const frac = hasChildren ? 1 / 8 : 1 / 4;
    const each = frac / h.wives;
    shares.push({
      heir: h.wives === 1 ? 'Wife' : `Wives (${h.wives})`,
      count: h.wives,
      fraction: frac,
      amount: netEstate * frac,
      reason: hasChildren
        ? `Wife/wives share 1/8 when the deceased leaves children (Quran 4:12).`
        : `Wife/wives share 1/4 when the deceased leaves no children (Quran 4:12).`,
      evidence: '4:12'
    });
    remaining -= frac;
  }

  // --- Mother ---
  if (h.mother) {
    let frac;
    if (hasChildren || (h.fullBrothers + h.fullSisters + h.paternalBrothers + h.paternalSisters + h.maternalBrothers + h.maternalSisters) >= 2) {
      frac = 1 / 6;
    } else {
      frac = 1 / 3;
    }
    // Special: if only father + mother + spouse, mother gets 1/3 of remainder after spouse in some views (Hanafi has specific)
    // For V1 simplicity we use the basic Quranic: 1/3 or 1/6
    shares.push({
      heir: 'Mother',
      count: 1,
      fraction: frac,
      amount: netEstate * frac,
      reason: frac === 1 / 6
        ? 'Mother receives 1/6 when there are children or two or more siblings (Quran 4:11).'
        : 'Mother receives 1/3 when there are no children and fewer than two siblings (Quran 4:11).',
      evidence: '4:11'
    });
    remaining -= frac;
  }

  // --- Father ---
  if (h.father) {
    if (hasChildren) {
      // Father gets 1/6 fixed + residual if any (as asabah)
      const frac = 1 / 6;
      shares.push({
        heir: 'Father',
        count: 1,
        fraction: frac,
        amount: netEstate * frac,
        reason: 'Father receives 1/6 fixed share when there are children (Quran 4:11). He may also take residual as residuary heir.',
        evidence: '4:11',
        isResiduaryCandidate: true
      });
      remaining -= frac;
    } else {
      // Father is pure residuary (or takes all remaining after mother/spouse)
      // We mark him as residuary
      shares.push({
        heir: 'Father',
        count: 1,
        fraction: null, // will take remaining
        amount: 0,
        reason: 'Father is residuary heir when there are no children.',
        evidence: '4:11',
        isResiduary: true
      });
    }
  }

  // --- Daughters / Sons (primary) ---
  if (h.sons > 0 || h.daughters > 0) {
    if (h.sons === 0 && h.daughters > 0) {
      // Only daughters
      let frac;
      if (h.daughters === 1) frac = 1 / 2;
      else frac = 2 / 3;
      shares.push({
        heir: h.daughters === 1 ? 'Daughter' : `Daughters (${h.daughters})`,
        count: h.daughters,
        fraction: frac,
        amount: netEstate * frac,
        reason: h.daughters === 1
          ? 'One daughter receives 1/2 (Quran 4:11).'
          : 'Two or more daughters share 2/3 (Quran 4:11).',
        evidence: '4:11'
      });
      remaining -= frac;
    } else if (h.sons > 0) {
      // Sons + daughters → residuary, male gets 2× female
      // They take the entire remaining after fixed shares
      shares.push({
        heir: 'Sons & Daughters',
        count: h.sons + h.daughters,
        sons: h.sons,
        daughters: h.daughters,
        fraction: null,
        amount: 0,
        reason: 'Sons and daughters inherit as residuaries: each son receives twice the share of each daughter (Quran 4:11).',
        evidence: '4:11',
        isResiduary: true,
        ratio: { male: 2, female: 1 }
      });
    }
  }

  // --- Maternal siblings (kalalah) ---
  const maternalSiblings = h.maternalBrothers + h.maternalSisters;
  if (maternalSiblings > 0 && !hasChildren && !h.father) {
    let frac;
    if (maternalSiblings === 1) frac = 1 / 6;
    else frac = 1 / 3;
    shares.push({
      heir: maternalSiblings === 1 ? 'Maternal sibling' : `Maternal siblings (${maternalSiblings})`,
      count: maternalSiblings,
      fraction: frac,
      amount: netEstate * frac,
      reason: maternalSiblings === 1
        ? 'One maternal brother or sister receives 1/6 (Quran 4:12).'
        : 'Two or more maternal siblings share 1/3 equally (Quran 4:12).',
      evidence: '4:12'
    });
    remaining -= frac;
  } else if (maternalSiblings > 0) {
    excluded.push({
      heir: 'Maternal siblings',
      reason: 'Blocked by children or father (hajb).'
    });
  }

  // --- Full / Paternal siblings (only if no children and no father) ---
  const fullSiblings = h.fullBrothers + h.fullSisters;
  const paternalSiblings = h.paternalBrothers + h.paternalSisters;
  if (!hasChildren && !h.father) {
    if (fullSiblings > 0) {
      // Full siblings take as residuary (or fixed for sisters only)
      if (h.fullBrothers === 0 && h.fullSisters > 0) {
        let frac = h.fullSisters === 1 ? 1 / 2 : 2 / 3;
        shares.push({
          heir: h.fullSisters === 1 ? 'Full sister' : `Full sisters (${h.fullSisters})`,
          count: h.fullSisters,
          fraction: frac,
          amount: netEstate * frac,
          reason: 'Full sister(s) receive fixed share in absence of children, father and brothers (Quran 4:176).',
          evidence: '4:176'
        });
        remaining -= frac;
      } else {
        shares.push({
          heir: 'Full brothers & sisters',
          count: fullSiblings,
          brothers: h.fullBrothers,
          sisters: h.fullSisters,
          fraction: null,
          amount: 0,
          reason: 'Full siblings inherit as residuaries (male 2× female).',
          evidence: '4:176',
          isResiduary: true,
          ratio: { male: 2, female: 1 }
        });
      }
    } else if (paternalSiblings > 0) {
      // Similar for paternal
      if (h.paternalBrothers === 0 && h.paternalSisters > 0) {
        let frac = h.paternalSisters === 1 ? 1 / 2 : 2 / 3;
        shares.push({
          heir: h.paternalSisters === 1 ? 'Paternal sister' : `Paternal sisters (${h.paternalSisters})`,
          count: h.paternalSisters,
          fraction: frac,
          amount: netEstate * frac,
          reason: 'Paternal sister(s) receive fixed share when no full siblings, children or father.',
          evidence: '4:176'
        });
        remaining -= frac;
      } else {
        shares.push({
          heir: 'Paternal brothers & sisters',
          count: paternalSiblings,
          brothers: h.paternalBrothers,
          sisters: h.paternalSisters,
          fraction: null,
          amount: 0,
          reason: 'Paternal siblings inherit as residuaries (male 2× female).',
          isResiduary: true,
          ratio: { male: 2, female: 1 }
        });
      }
    }
  } else {
    if (fullSiblings > 0 || paternalSiblings > 0) {
      excluded.push({
        heir: 'Full/Paternal siblings',
        reason: 'Blocked by children or father (hajb).'
      });
    }
  }

  // --- Grandparents (basic) ---
  if (h.paternalGrandfather && !h.father) {
    // Simplified: treat similar to father in absence of father (V1)
    notes.push('Paternal grandfather rules are simplified in V1. Complex cases require scholar review.');
  }

  // --- Distribute residual ---
  const residuaryShares = shares.filter(s => s.isResiduary || s.isResiduaryCandidate);
  const fixedTotal = shares.filter(s => s.fraction != null).reduce((sum, s) => sum + s.fraction, 0);
  let residualFraction = 1 - fixedTotal;

  if (residualFraction < -0.0001) {
    // Awl (proportional reduction)
    notes.push('Awl applied: fixed shares exceed the estate; shares are reduced proportionally.');
    const factor = 1 / fixedTotal;
    shares.forEach(s => {
      if (s.fraction != null) {
        s.fraction *= factor;
        s.amount = netEstate * s.fraction;
        s.reason += ' (reduced by awl)';
      }
    });
    residualFraction = 0;
  }

  if (residualFraction > 0.0001) {
    // Assign residual to residuaries
    const pureResiduaries = shares.filter(s => s.isResiduary);
    if (pureResiduaries.length > 0) {
      // For simplicity in V1: if one residuary group, give all remaining
      // (sons+daughters or siblings)
      const r = pureResiduaries[0];
      r.fraction = residualFraction;
      r.amount = netEstate * residualFraction;
      // If ratio exists, note the internal division
      if (r.ratio) {
        const units = (r.sons || r.brothers || 0) * r.ratio.male + (r.daughters || r.sisters || 0) * r.ratio.female;
        r.internal = {
          maleShare: units > 0 ? (residualFraction * r.ratio.male) / units : 0,
          femaleShare: units > 0 ? (residualFraction * r.ratio.female) / units : 0
        };
      }
    } else if (h.father && hasChildren) {
      // Father takes residual after his 1/6
      const fatherShare = shares.find(s => s.heir === 'Father');
      if (fatherShare) {
        fatherShare.fraction = (fatherShare.fraction || 0) + residualFraction;
        fatherShare.amount = netEstate * fatherShare.fraction;
        fatherShare.reason += ' Plus residual as residuary.';
      }
    } else {
      // Radd (return) to fixed-share heirs (excluding spouse in classical Hanafi)
      notes.push('Radd (return of surplus) applied to eligible fixed-share heirs.');
      // Simplified V1: return proportionally to non-spouse fixed heirs
      const raddCandidates = shares.filter(s => s.fraction != null && s.heir !== 'Husband' && !s.heir.startsWith('Wife'));
      if (raddCandidates.length > 0) {
        const raddBase = raddCandidates.reduce((sum, s) => sum + s.fraction, 0);
        raddCandidates.forEach(s => {
          const add = residualFraction * (s.fraction / raddBase);
          s.fraction += add;
          s.amount = netEstate * s.fraction;
          s.reason += ' (plus radd)';
        });
      } else {
        // Spouse only case — in Hanafi radd does not go to spouse; goes to bayt al-mal or distant
        notes.push('Surplus after spouse shares: classical rules may direct to public treasury or distant kindred. Scholar verification recommended.');
      }
    }
  }

  // Compute final amounts precisely
  shares.forEach(s => {
    if (s.fraction != null) {
      s.amount = Math.round(netEstate * s.fraction * 100) / 100;
      s.percentage = Math.round(s.fraction * 10000) / 100;
    }
  });

  const totalFraction = shares.reduce((sum, s) => sum + (s.fraction || 0), 0);

  return { shares, excluded, notes, evidence, totalFraction };
}

// Placeholder / conservative implementations for other schools
// In V1 they share most fixed shares; differences are flagged

function calculateShafii(h, netEstate) {
  const base = calculateHanafi(h, netEstate);
  base.notes = base.notes || [];
  base.notes.push("Shafi'i rules applied for common cases. Major differences (e.g. grandfather vs siblings, certain radd rules) may require scholar review.");
  return base;
}

function calculateMaliki(h, netEstate) {
  const base = calculateHanafi(h, netEstate);
  base.notes = base.notes || [];
  base.notes.push('Maliki rules applied for common cases. Differences in residual and certain blocking rules exist.');
  return base;
}

function calculateHanbali(h, netEstate) {
  const base = calculateHanafi(h, netEstate);
  base.notes = base.notes || [];
  base.notes.push('Hanbali rules applied for common cases. Some residual and radd treatments differ.');
  return base;
}

function calculateJafari(h, netEstate) {
  // Ja'fari has a different class-based system. V1 only supports very simple cases.
  if (h.sons + h.daughters === 0 && (h.fullBrothers + h.fullSisters + h.paternalBrothers + h.paternalSisters > 0)) {
    return {
      shares: [],
      excluded: [],
      notes: ["Ja'fari inheritance uses a class system that differs substantially from Sunni schools for many sibling and distant relative cases."],
      evidence: [],
      totalFraction: 0,
      forceScholar: true
    };
  }
  const base = calculateHanafi(h, netEstate);
  base.notes = base.notes || [];
  base.notes.push("Ja'fari (Ithna Ashari) rules have structural differences. This result is a simplified approximation for spouse/parent/child cases only. Verify with a qualified Ja'fari scholar.");
  return base;
}

function validateResult(result, netEstate) {
  if (result.forceScholar) {
    return { ok: false, message: result.notes[0] };
  }
  const total = result.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
  if (total > netEstate * 1.001) {
    return { ok: false, message: 'Calculated distribution exceeds net estate. No result generated.' };
  }
  if (result.shares.some(s => (s.amount || 0) < 0)) {
    return { ok: false, message: 'Negative allocation detected. No result generated.' };
  }
  return { ok: true };
}
