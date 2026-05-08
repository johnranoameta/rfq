import { getStoredMatchScoringConfig } from "@/lib/rfq/sqlite/matchSettings";

export type MatchScoringConfig = {
  weights: {
    materialExact: number;
    programExact: number;
    processExact: number;
    customerOverlap: number;
    partNameSubstring: number;
    exactPartNumber: number;
    partNameSimilarityHigh: number;
    partNameSimilarityMedium: number;
    specSimilarityHigh: number;
    specSimilarityMedium: number;
    featureSimilarityHigh: number;
    featureSimilarityMedium: number;
    thicknessMatch: number;
    thicknessClose: number;
    volumeSimilar: number;
    volumeRelated: number;
  };
  thresholds: {
    partNameSimilarityHigh: number;
    partNameSimilarityMedium: number;
    specSimilarityHigh: number;
    specSimilarityMedium: number;
    featureSimilarityHigh: number;
    featureSimilarityMedium: number;
    thicknessMatchRatio: number;
    thicknessCloseRatio: number;
    volumeSimilarRatio: number;
    volumeRelatedRatio: number;
  };
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function numOverride(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Central tuning surface for historical match scoring (override via env). */
export function getMatchScoringConfig(): MatchScoringConfig {
  const base: MatchScoringConfig = {
    weights: {
      materialExact: numEnv("RFQ_MATCH_W_MATERIAL", 20),
      programExact: numEnv("RFQ_MATCH_W_PROGRAM", 14),
      processExact: numEnv("RFQ_MATCH_W_PROCESS", 16),
      customerOverlap: numEnv("RFQ_MATCH_W_CUSTOMER", 6),
      partNameSubstring: numEnv("RFQ_MATCH_W_PART_SUBSTRING", 8),
      exactPartNumber: numEnv("RFQ_MATCH_W_EXACT_PN", 26),
      partNameSimilarityHigh: numEnv("RFQ_MATCH_W_NAME_SIM_HIGH", 8),
      partNameSimilarityMedium: numEnv("RFQ_MATCH_W_NAME_SIM_MED", 4),
      specSimilarityHigh: numEnv("RFQ_MATCH_W_SPEC_SIM_HIGH", 8),
      specSimilarityMedium: numEnv("RFQ_MATCH_W_SPEC_SIM_MED", 4),
      featureSimilarityHigh: numEnv("RFQ_MATCH_W_FEATURE_SIM_HIGH", 6),
      featureSimilarityMedium: numEnv("RFQ_MATCH_W_FEATURE_SIM_MED", 3),
      thicknessMatch: numEnv("RFQ_MATCH_W_THICK_MATCH", 6),
      thicknessClose: numEnv("RFQ_MATCH_W_THICK_CLOSE", 3),
      volumeSimilar: numEnv("RFQ_MATCH_W_VOL_SIMILAR", 6),
      volumeRelated: numEnv("RFQ_MATCH_W_VOL_RELATED", 3),
    },
    thresholds: {
      partNameSimilarityHigh: numEnv("RFQ_MATCH_T_NAME_SIM_HIGH", 0.7),
      partNameSimilarityMedium: numEnv("RFQ_MATCH_T_NAME_SIM_MED", 0.4),
      specSimilarityHigh: numEnv("RFQ_MATCH_T_SPEC_SIM_HIGH", 0.5),
      specSimilarityMedium: numEnv("RFQ_MATCH_T_SPEC_SIM_MED", 0.25),
      featureSimilarityHigh: numEnv("RFQ_MATCH_T_FEATURE_SIM_HIGH", 0.5),
      featureSimilarityMedium: numEnv("RFQ_MATCH_T_FEATURE_SIM_MED", 0.25),
      thicknessMatchRatio: numEnv("RFQ_MATCH_T_THICK_MATCH", 1.08),
      thicknessCloseRatio: numEnv("RFQ_MATCH_T_THICK_CLOSE", 1.2),
      volumeSimilarRatio: numEnv("RFQ_MATCH_T_VOL_SIMILAR", 1.35),
      volumeRelatedRatio: numEnv("RFQ_MATCH_T_VOL_RELATED", 2),
    },
  };
  const stored = getStoredMatchScoringConfig();
  if (!stored) return base;
  const sw = (stored.weights as Record<string, unknown> | undefined) ?? {};
  const st = (stored.thresholds as Record<string, unknown> | undefined) ?? {};
  return {
    weights: {
      materialExact: numOverride(sw.materialExact, base.weights.materialExact),
      programExact: numOverride(sw.programExact, base.weights.programExact),
      processExact: numOverride(sw.processExact, base.weights.processExact),
      customerOverlap: numOverride(sw.customerOverlap, base.weights.customerOverlap),
      partNameSubstring: numOverride(sw.partNameSubstring, base.weights.partNameSubstring),
      exactPartNumber: numOverride(sw.exactPartNumber, base.weights.exactPartNumber),
      partNameSimilarityHigh: numOverride(sw.partNameSimilarityHigh, base.weights.partNameSimilarityHigh),
      partNameSimilarityMedium: numOverride(sw.partNameSimilarityMedium, base.weights.partNameSimilarityMedium),
      specSimilarityHigh: numOverride(sw.specSimilarityHigh, base.weights.specSimilarityHigh),
      specSimilarityMedium: numOverride(sw.specSimilarityMedium, base.weights.specSimilarityMedium),
      featureSimilarityHigh: numOverride(sw.featureSimilarityHigh, base.weights.featureSimilarityHigh),
      featureSimilarityMedium: numOverride(sw.featureSimilarityMedium, base.weights.featureSimilarityMedium),
      thicknessMatch: numOverride(sw.thicknessMatch, base.weights.thicknessMatch),
      thicknessClose: numOverride(sw.thicknessClose, base.weights.thicknessClose),
      volumeSimilar: numOverride(sw.volumeSimilar, base.weights.volumeSimilar),
      volumeRelated: numOverride(sw.volumeRelated, base.weights.volumeRelated),
    },
    thresholds: {
      partNameSimilarityHigh: numOverride(st.partNameSimilarityHigh, base.thresholds.partNameSimilarityHigh),
      partNameSimilarityMedium: numOverride(st.partNameSimilarityMedium, base.thresholds.partNameSimilarityMedium),
      specSimilarityHigh: numOverride(st.specSimilarityHigh, base.thresholds.specSimilarityHigh),
      specSimilarityMedium: numOverride(st.specSimilarityMedium, base.thresholds.specSimilarityMedium),
      featureSimilarityHigh: numOverride(st.featureSimilarityHigh, base.thresholds.featureSimilarityHigh),
      featureSimilarityMedium: numOverride(st.featureSimilarityMedium, base.thresholds.featureSimilarityMedium),
      thicknessMatchRatio: numOverride(st.thicknessMatchRatio, base.thresholds.thicknessMatchRatio),
      thicknessCloseRatio: numOverride(st.thicknessCloseRatio, base.thresholds.thicknessCloseRatio),
      volumeSimilarRatio: numOverride(st.volumeSimilarRatio, base.thresholds.volumeSimilarRatio),
      volumeRelatedRatio: numOverride(st.volumeRelatedRatio, base.thresholds.volumeRelatedRatio),
    },
  };
}

