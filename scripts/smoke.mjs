import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { runTreuhandAgent } from "../src/agent.js";
import { createInitialStore } from "../src/demoData.js";
import { sampleCaseImports } from "../src/phase2SampleCases.js";
import { FAILURE_TAGS, runValidationSample } from "../src/validation.js";

await Promise.all([
  access("index.html"),
  access("src/app.js"),
  access("src/styles.css"),
  access("README.md")
]);

const html = await readFile("index.html", "utf8");
assert.match(html, /AgentOps Core/);
assert.match(html, /src\/app.js/);
assert.match(html, /Context/);
assert.match(html, /Controls/);
assert.match(html, /Validation/);

const store = createInitialStore();
const output = runTreuhandAgent(store.cases[0]);

assert.equal(output.agent_code, "A-TREU-001");
assert.equal(output.status, "needs_review");
assert.ok(output.metrics.documents_processed >= 3);
assert.ok(output.recommendations.every((item) => item.requires_human_approval));
assert.ok(store.contextPackets.length >= 3);
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-INGEST-001"));
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-SEC-001"));
assert.ok(store.controlAgentOutputs.some((item) => item.agentCode === "A-CAD-001"));
assert.ok(store.validationCaseImports.length >= 2);
assert.ok(FAILURE_TAGS.some((tag) => tag.id === "checklist_mismatch"));

const validationResults = sampleCaseImports.map((sample) => runValidationSample(sample));
assert.equal(validationResults.length >= 2, true);
assert.ok(validationResults.every((result) => result.validationRecord.runId === result.run.id));
assert.ok(validationResults.every((result) => result.memo.includes("Before/After Operating Memo")));

console.log("Smoke check passed: static app files load and Phase 2 validation samples produce review-gated output.");
