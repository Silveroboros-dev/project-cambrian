# Parallel Development Contract

Version: 0.1
Date: 2026-07-01
Audience: human operators, Codex agents, Claude agents, and any other worker editing this repository

## Purpose

This repo may have multiple agents working at once. The goal of this contract is to keep `main` deployable, prevent agents from overwriting each other, and make every branch easy to review and merge.

The rule is simple:

> Integrator owns `main`. Worker agents use scoped branches, explicit staging, tests, and handoff notes.

## Non-Negotiable Rules

- Do not commit or push directly to `main` unless the human operator explicitly says there is only one active committer and direct `main` work is allowed.
- Do not use `git add .` unless the full diff has been reviewed and every file is intentionally in scope.
- Do not stage another agent's changes.
- Do not rewrite another agent's branch.
- Do not force-push to `main`.
- Do not add real client, bank, customer, reviewer, investor, or private-contact data.
- Do not add secrets, credentials, tokens, or private configuration.
- Do not add production connectors, databases, cloud services, OCR, LLM calls, auth systems, or external side effects without explicit approval.
- Keep human approval gates first-class for client-facing drafts, access decisions, memory promotion, regulated conclusions, and financial decisions.

## Project Cambrian Product Boundary

The current proof is a local, deterministic workflow-agent harness for trusted SME operations, with the active Treuhand/accounting proof remaining the main project wedge.

Other demos, including bank or credit workflows, must stay clearly separated unless the human operator explicitly says to integrate them into the main Cambrian demo.

All demos must preserve:

- synthetic/local data labels;
- no real external execution;
- no autonomous professional, tax, legal, credit, access, payment, or filing decisions;
- explicit human review gates;
- traceability from source event to work order, cards, approval, follow-through, logs, and validation where applicable.

## Roles

### Integrator

The integrator is the only actor allowed to update `main`.

Responsibilities:

- keep `main` test-green and demo-safe;
- assign or acknowledge active task branches;
- review branch diffs before merge;
- resolve overlaps between branches;
- run required verification before pushing `main`;
- reject ornamental architecture that does not help demo reliability, reviewer trust, evidence traceability, measurable operating lift, confidentiality, or paid-audit conversion.

### Worker Agent

A worker agent owns one scoped task branch.

Responsibilities:

- start from fresh `main`;
- declare scope and out-of-scope files;
- keep the diff narrow;
- stage explicit files or hunks only;
- run required checks;
- push only the task branch;
- provide a handoff.

## Start-Of-Task Checklist

Before editing, a worker agent must run:

```bash
git fetch origin
git status --short --branch
git rev-parse --short HEAD
git log --oneline --decorate -3
gh pr list --state open --limit 20
git ls-remote --heads origin
```

Then record:

```text
Base:
Branch:
Scope:
Out of scope:
Expected verification:
```

## Branch Rules

Create one branch per task from fresh `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/<short-task-name>
```

Use a different prefix if helpful:

```text
codex/situation-demo-focus
codex/uzbek-bank-demo
claude/credit-demo-copy-pass
human/product-doc-pass
```

Worker branches should be pushed as branches, not directly merged:

```bash
git push -u origin <branch>
```

If a PR is opened, report the PR number and URL. A `/pull/new/<branch>` link is only a PR creation page, not an opened PR.

## Staging Rules

Always inspect before staging:

```bash
git status --short
git diff --stat
git diff --name-status
```

Prefer explicit staging:

```bash
git add path/to/file.md
git add src/specificFile.js
```

For mixed files, use patch staging:

```bash
git add -p src/app.js
git add -p src/styles.css
git add -p index.html
git add -p src/state.js
```

Mixed files require special care because multiple demos may touch the app shell, state migration, and shared CSS.

## Verification

Before committing or pushing code/UI changes:

```bash
git diff --check
npm test
npm run smoke
```

For docs-only changes, run `git diff --check`. If the changed doc is read by a contract test, run `npm test`.

## Commit Rules

Use clear, scoped commit messages:

```text
Add Situation Room demo focus pointers
Add workflow kernel readiness report
Add local Uzbek bank credit demo
Document parallel development contract
```

Do not bundle unrelated tasks in one commit. Do not include local runtime artifacts such as `.zip` files unless explicitly requested.

## Worker Handoff Format

Every worker branch handoff must include:

```text
Branch:
Commit:
Base main:
Remote state: local-only | pushed-no-PR | PR #<n> <url>
Changed areas:
Verification:
Known risks:
Integrator notes:
```

Use precise remote-state language:

- `local-only`: commit exists locally only;
- `pushed-no-PR`: branch exists on origin, no PR is open;
- `PR opened`: PR number and URL exist.

## Integrator Merge Checklist

Before merging a worker branch:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git diff --stat origin/main..<branch>
git diff --name-status origin/main..<branch>
```

Then inspect risk areas manually:

- `index.html`;
- `src/app.js`;
- `src/styles.css`;
- `src/state.js`;
- `README.md`;
- contract docs under `docs/*-contract.md`;
- generated images, PDFs, ZIPs, and other binary artifacts.

Run:

```bash
git diff --check origin/main..<branch>
npm test
npm run smoke
```

Merge only after the branch scope, product boundary, privacy boundary, and verification are acceptable.

## Current Repo Warning Pattern

This repo commonly has overlapping work in:

- Situation Room demo UI;
- Treuhand validation;
- workflow-kernel readiness docs/tests;
- website/services-page docs;
- local bank or credit demo experiments;
- ZIP handoffs and screenshots.

Because of that, assume a dirty tree contains multiple authors' work. Review before staging. If a file mixes task scopes, use patch staging or ask the human operator to split branches.

## Example: Uzbek Bank Demo Worker Scope

A worker building the Uzbek bank demo should use a branch such as:

```text
codex/uzbek-bank-demo
```

Likely in scope:

- `src/loanUnderwriting.js`;
- `src/loanSampleCases.js`;
- `tests/loanUnderwriting.test.mjs`;
- bank demo docs under `docs/`;
- bank demo screenshots under `docs/bank-demo-screens/`;
- only the specific `src/app.js`, `src/styles.css`, `src/state.js`, and `index.html` hunks needed for that demo.

Explicitly out of scope unless coordinated:

- Treuhand Situation Room demo-focus work;
- workflow-kernel readiness work;
- Phase 2 validation contracts;
- website/services-page work;
- unrelated PDFs, ZIPs, or private notes.

The Uzbek bank demo must remain synthetic/local, with no real bank/customer data and no autonomous credit decision. The human decision gate is mandatory.
