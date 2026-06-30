import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("harness UI contract includes all acceptance criteria", async () => {
  const contract = await readFile("docs/harness-ui-contract.md", "utf8");

  for (let index = 1; index <= 10; index += 1) {
    assert.match(contract, new RegExp(`AC-${index}:`));
  }

  assert.match(contract, /caseId/);
  assert.match(contract, /contextPacketId/);
  assert.match(contract, /runId/);
  assert.match(contract, /A-INGEST-001/);
  assert.match(contract, /A-AUTH-001/);
  assert.match(contract, /A-SEC-001/);
  assert.match(contract, /A-GAP-001/);
  assert.match(contract, /A-CAD-001/);
});

test("working spec states Swiss SME objective and avoids agentic theater", async () => {
  const spec = await readFile("docs/agentops-core-working-spec.md", "utf8");

  assert.match(spec, /Swiss SME/);
  assert.match(spec, /owners\/operators|owner, operator/);
  assert.match(spec, /most advanced agentic system/);
  assert.match(spec, /cost vs value/);
  assert.match(spec, /latency vs accuracy/);
});
