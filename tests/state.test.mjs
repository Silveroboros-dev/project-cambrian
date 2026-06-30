import test from "node:test";
import assert from "node:assert/strict";
import { sampleCaseImports } from "../src/phase2SampleCases.js";
import { ensureStoreShape } from "../src/state.js";

test("state migration labels legacy validation record rating sources", () => {
  const shaped = ensureStoreShape({
    validationRecords: [
      {
        id: "val_legacy_fixture",
        sampleCaseId: sampleCaseImports[0].sampleCaseId,
        runId: "run_case_sample_march_2026_phase2_fixture",
        reviewerRating: {
          overallUsefulness: 4
        }
      },
      {
        id: "val_legacy_human",
        sampleCaseId: "manual_case_001",
        runId: "run_manual_case_001",
        reviewerRating: {
          overallUsefulness: 4
        }
      }
    ]
  });

  assert.equal(shaped.validationRecords[0].reviewerRating.ratingSource, "fixture_seed");
  assert.equal(shaped.validationRecords[1].reviewerRating.ratingSource, "human_capture");
});

test("state shape includes local validation import and export surfaces", () => {
  const shaped = ensureStoreShape({});

  assert.equal(shaped.validationImportStatus, null);
  assert.equal(shaped.validationExportStatus, null);
  assert.equal(shaped.validationExportPackage, null);
});
