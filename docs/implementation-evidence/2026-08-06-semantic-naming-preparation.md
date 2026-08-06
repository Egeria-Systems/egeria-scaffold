# Semantic Naming Enforcement Preparation Evidence

**Date:** 2026-08-06

**Purpose:** Freeze the current repository evidence needed to broaden semantic naming from phase-only examples to generic roadmap and implementation-sequencing labels, including ordinary test and suite descriptions.

## Scope and repository state

- Repository: `/Users/CoveMB/Code/CoveMB/egeria-scaffold`
- Branch: local `main`, 39 commits ahead of the locally recorded `origin/main`
- Frozen planning base: `ed33e97b4a9424a44c1b7d363584a43ca711c164`
- Remote refs were not fetched because current remote freshness does not affect this repository-local naming contract.
- Preserved user-owned work:
  - modified `AGENTS.md` containing the functional-programming discipline.

The deterministic-rendering preparation and plan were committed as `ed33e97` while this preparation was being written. The naming plan was re-frozen against that commit; the two files are now committed direct consumers rather than untracked work.

No implementation, configuration, test, main-plan, or active rendering-plan file was changed during this preparation pass.

## Existing canonical rule

Root `AGENTS.md` already establishes the correct principle: roadmap labels describe sequencing and provenance, not software responsibility. It prohibits phase labels in executable paths, commands, configuration keys, APIs, errors, schemas, generated paths, and ordinary test or fixture identifiers, while allowing phase-subject historical and planning documentation.

The current wording and enforcement are narrower than the requested contract:

- examples emphasize compact phase labels such as `P0.3` and `P1`;
- test and suite descriptions are not named explicitly;
- there is no generic repository scanner for paths and authored text;
- there is no repository-local ESLint fail-fast rule;
- current contracts use exact one-off negative assertions rather than one canonical label taxonomy.

## Current leakage inventory

A repository-wide read-only search found no current roadmap label in a live package-script key, workflow command, schema title, exported implementation symbol, or production source path. The earlier semantic-name normalization therefore succeeded for the live public and internal surfaces it targeted.

The remaining executable-test leakage is 37 matching source lines across six files:

| File | Current leakage |
| --- | --- |
| `packages/builder-core/tests/contracts.test.mjs` | one obsolete phase-labelled schema title retained as a negative literal |
| `packages/builder-core/tests/resolution.test.mjs` | three obsolete phase-labelled API/type names retained as negative literals |
| `tests/package-boundaries/internal-linting.test.mjs` | one obsolete phase-labelled script key retained as a negative literal |
| `tests/package-boundaries/release-safeguards.test.mjs` | four obsolete phase-labelled script keys retained as negative literals |
| `tests/package-boundaries/private-packages.test.mjs` | two ordinary test descriptions, two obsolete phase-labelled source paths, and three phase/task ownership assertions |
| `tests/constitution/constitution.test.mjs` | two ordinary test descriptions plus historical phase/gate headings, paths, regular expressions, script-name negatives, and one phase-derived local identifier |

The four ordinary test descriptions are material because test-runner output presents them as the stable behavioral vocabulary of the suite. Historical-document assertions remain useful, but their source literals and local names can be constructed or named semantically so the executable test surface does not adopt the roadmap vocabulary.

The active deterministic-rendering plan also contains a direct future conflict: it instructs the package-boundary test title to advance from one numbered task label to another and requires direct-owner documents to use that task label. That instruction must be amended before its boundary step executes, without rewriting its task headings, evidence names, or other provenance.

## Selected enforcement shape

The smallest resilient combination is:

1. one permanent repository contract with a single canonical matcher;
2. one permanent Git-aware path and authored-text scanner invoked by that contract and by a direct root command;
3. one temporary repository-local ESLint adapter for fast JavaScript and TypeScript feedback during the remaining builder implementation;
4. one explicit sunset gate at the end of the main P1 plan's final implementation task, after the permanent contract proves equivalent coverage.

The matcher covers:

- compact phase ordinals, including numeric, dotted, suffixed, and placeholder forms;
- named sequencing prefixes followed by a numeric/dotted/suffixed ordinal or placeholder, including phase, task, stage, step, part, milestone, gate, wave, workstream, sprint, iteration, increment, epic, and story;
- standalone text, file/path segments, snake/kebab names, and camel/Pascal identifier boundaries.

Counterexamples such as peer-to-peer terminology, `taskQueue`, `stepCount`, `stageName`, and `incrementValue` require explicit contract coverage so the checker enforces labels rather than ordinary domain words.

The permanent scanner owns completeness. The ESLint rule is intentionally a local adapter, is not exported from `@egeria-systems/standards`, does not affect the separately accepted compatibility proof, and must not survive after its equivalence/sunset gate.

## Current official-source checks

Checked on 2026-08-06:

- Git documents that `git ls-files --cached --others --exclude-standard` can enumerate tracked plus non-ignored untracked repository paths. NUL-delimited output avoids newline-delimited path ambiguity: <https://git-scm.com/docs/git-ls-files>.
- ESLint documents repository-local custom rules and the Node.js API needed to exercise a rule without publishing a plugin: <https://eslint.org/docs/latest/extend/custom-rules> and <https://eslint.org/docs/latest/integrate/nodejs-api>.
- Node's test runner uses the supplied test name in its reported test output, supporting explicit coverage of test and suite descriptions: <https://nodejs.org/api/test.html>.

These sources support the implementation mechanism only. They do not prove the repository-specific taxonomy, exception boundary, or absence of leakage; the new executable contract must prove those properties against the current tree.

## Limits and approval boundary

- This preparation does not authorize implementation, commits, push, pull request, deployment, publication, or changes to the user's active rendering work.
- Documentation may retain sequencing labels when the sequence or historical record is the subject. The permanent checker must not erase provenance.
- A lexical checker cannot infer every possible euphemism. The canonical prefix data and tests define the enforceable vocabulary and provide one low-churn expansion point.
- The temporary ESLint rule may be removed only after permanent-contract equivalence is demonstrated on positive, negative, path, identifier, comment, string, and test-description cases.
