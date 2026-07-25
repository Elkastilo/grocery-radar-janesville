const POINTS = {
  submit_typed_price: 1,
  submit_shelf_tag_photo: 1,
  submit_receipt_photo: 1,
  submit_weekly_ad: 1,
  verify_another_price: 2,
  submitted_price_verified_bonus: 5,
  high_confidence_bonus: 10,
  wrong_fake_report_penalty: -10,
  proof_accepted_reviewable: 1,
  proof_used_for_approved_price: 2,
  approved_price_from_proof: 2,
  approved_weekly_ad_deal: 2,
  approved_receipt_item: 2,
  proof_source_link_bonus: 1,
  proof_clear_photo_bonus: 1,
  duplicate_confirmation: 1,
  verified_correction: 0,
  proof_daily_cap: 10,
  proof_batch_cap: 5,
  proof_daily_cap_new: 10,
  proof_daily_cap_reliable: 20,
  proof_daily_cap_trusted: 40,
  proof_daily_cap_priority: 75,
  proof_daily_cap_field_verified: 75
};

const REWARD_RULES = [
  {
    points: 10,
    label: "daily new contributor proof cap",
    active: true
  },
  {
    points: 20,
    label: "daily reliable proof cap",
    active: true
  },
  {
    points: 40,
    label: "daily trusted contributor cap",
    active: true
  },
  {
    points: 75,
    label: "daily priority contributor cap",
    active: true
  }
];

const TRUST_LEVELS = [
  {
    level: 0,
    key: "new",
    label: "New Contributor",
    daily_cap: POINTS.proof_daily_cap_new
  },
  {
    level: 1,
    key: "reliable_proof",
    label: "Reliable Proof",
    daily_cap: POINTS.proof_daily_cap_reliable
  },
  {
    level: 2,
    key: "trusted_contributor",
    label: "Trusted Contributor",
    daily_cap: POINTS.proof_daily_cap_trusted
  },
  {
    level: 3,
    key: "priority_contributor",
    label: "Priority Contributor",
    daily_cap: POINTS.proof_daily_cap_priority
  },
  {
    level: 4,
    key: "field_verified",
    label: "Field Verified / Admin Verified",
    daily_cap: POINTS.proof_daily_cap_field_verified
  }
];

function getSubmissionPoints(proofType) {
  if (proofType === "receipt_photo") {
    return POINTS.submit_receipt_photo;
  }

  if (proofType === "shelf_tag_photo") {
    return POINTS.submit_shelf_tag_photo;
  }

  if (proofType === "weekly_ad") {
    return POINTS.submit_weekly_ad;
  }

  return POINTS.submit_typed_price;
}

function getRank(points) {
  const total = Number(points) || 0;

  if (total >= 1500) {
    return "Community Helper";
  }

  if (total >= 500) {
    return "Consistent Proof Helper";
  }

  if (total >= 100) {
    return "Trusted Price Helper";
  }

  if (total >= 25) {
    return "Proof Spotter";
  }

  return "New Contributor";
}

function trustLevelFromStats(stats = {}) {
  const acceptedProofs = Number(stats.accepted_proof_count || 0);
  const approvedFromProof = Number(stats.approved_prices_from_proof || 0);
  const rejectedProofs = Number(stats.rejected_proof_count || 0);
  const duplicateProofs = Number(stats.duplicate_proof_count || 0);
  const unclearProofs = Number(stats.unclear_proof_count || 0);
  const adminNote = String(stats.admin_note || "").toLowerCase();

  if (stats.is_admin || adminNote.includes("field verified") || adminNote.includes("admin verified")) {
    return TRUST_LEVELS[4];
  }

  if (approvedFromProof >= 20 && acceptedProofs >= 10 && rejectedProofs === 0 && duplicateProofs <= 1 && unclearProofs <= 1) {
    return TRUST_LEVELS[3];
  }

  if (approvedFromProof >= 8 && acceptedProofs >= 5 && rejectedProofs <= 1 && duplicateProofs <= 2 && unclearProofs <= 2) {
    return TRUST_LEVELS[2];
  }

  if (acceptedProofs >= 3 && rejectedProofs <= 1 && duplicateProofs <= 2) {
    return TRUST_LEVELS[1];
  }

  return TRUST_LEVELS[0];
}

function confidenceWeight(confidence) {
  const weights = {
    high: 5,
    "medium-high": 4,
    medium: 3,
    low: 2,
    disputed: 1,
    expired: 0
  };

  return weights[confidence] || 0;
}

module.exports = {
  POINTS,
  REWARD_RULES,
  TRUST_LEVELS,
  getSubmissionPoints,
  getRank,
  trustLevelFromStats,
  confidenceWeight
};
