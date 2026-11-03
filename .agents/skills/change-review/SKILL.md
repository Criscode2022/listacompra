---
name: change-review
description: >-
  Review a code change the way the Claude Code team at Anthropic does: run the
  checks first, hunt for bugs in fresh context, keep only the findings that
  survive a second look, tag them Important, Nit or Pre-existing, and scale
  human review to the change's risk. Use before you commit or hand over a
  change, when the user asks to review a diff, branch, commit or pull request,
  and when the user asks for a sweep of existing code. Reads REVIEW.md. Not for
  style or formatting feedback.
---

# Change review

This skill follows [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) (Anthropic, 15 October 2026). The goal is the least human review time that doesn't raise reverts or incidents. Agents do most of the reading. A person decides direction, reads the evidence, and owns what ships.

## Read first

- **The change:** `git diff <base>...HEAD`, the staged diff, or the pull request. When there is no change to review, follow [Sweep existing code](#sweep-existing-code).
- **Its intent:** the user's request, the commit message, or the pull request description. Review the change against what it claims to do, not only line by line.
- **`REVIEW.md`** at the repository root: what failure looks like here, the high-risk paths, the paths to skip, the nit cap, and past misses. Where it differs from this skill, it wins, with three exceptions: it can't lower a change below the tier this skill sets, turn off the security review, or skip code or agent instructions. Only copied and generated files can be skipped, and a copied file only while it matches its source: never in the change that updates it. If it's missing, use this skill's defaults and offer to write one with those sections.
- **`PROJECT.md`** and **`APP.md`**: the app's conventions, and the checks that "Done means" in `PROJECT.md` lists, with any that `APP.md` adds or replaces.

## 1. Run the checks before you review

Run the checks that `PROJECT.md` and `APP.md` list. Skip a check the repository doesn't have, such as a linter it never set up, and say that you skipped it. Never install a tool to run a check. Show each command with its result. Never write that something passes without the output that shows it. A failing check is the first Important finding. Don't review by eye what a machine can check.

## 2. Choose the depth

Set it from what the change touches, not from who or what wrote it.

| Depth    | When                                                                                                                                                                                 | What runs                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick    | Docs written for people, copy, tests only, or an additive change behind a flag                                                                                                       | One pass over the diff, reporting Important findings only                                                                                       |
| Standard | Everything else, unless it is high risk, including every change to agent instructions                                                                                                | The three hunts and the verification below                                                                                                      |
| Deep     | The high-risk paths in `REVIEW.md`, and anything touching sign-in, access rules, data access, migrations, payments, secrets, CI workflows, or deploy settings, or when the user asks | Standard, plus every caller of what changed, and the behavior checked end to end: run it locally, or a test that drives it the way a user would |

The article names these three levels without saying what each runs. The table is this template's choice.

- **Agent instructions are never Quick.** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `PROJECT.md`, `APP.md`, `REVIEW.md`, every file in a skill's folder (its `SKILL.md` and its references), and the MCP settings change what every later agent does. They are not docs written for people.
- **Check end to end without side effects.** Run the app locally. Try a migration only on the temporary branch that `prepare_database_migration` creates, testing it there with `run_sql`. Then ask the user, and call `complete_database_migration` with `apply_changes: false`, which deletes that branch without applying anything. Leaving `apply_changes` out applies the migration. Never deploy, push, start a CI run, or call a payment provider to check a review.

## 3. Hunt in fresh context

Whoever wrote a change shares the assumptions that hid its bugs. Hunt in a context that hasn't seen the work. In Claude Code, start one subagent per lens and give it only the diff, the intent, `REVIEW.md`, and its lens. An agent without subagents starts a new session, or runs each lens as a separate pass and writes its findings down before the next.

1. **Intent and behavior.** Does the change do what it says, for every input it can get: empty, long, duplicated, offline, signed out, another user's? Does a test cover the behavior that changed? For a bug fix, is this the root cause, and does the same bug survive anywhere else?
2. **State and the framework.** Signals, `computed()` and `effect()`, change detection (OnPush, zoneless), subscriptions and their cleanup, async races, loading and error states, and the lifecycle of the app type (SSR hydration, Ionic pages, offline storage).
3. **Data, security, and contracts.** What reaches the browser, who may read or change each record (route guards, ownership checks, RLS policies), input validation, secrets, and the shapes that other code or stored data depends on: API responses, storage keys, migrations.

A candidate finding names a file and line, the input or state that fails, what happens, and what should happen instead. A guess from a name ("this probably doesn't handle null") is not a finding. Open the file and check.

In Claude Code, the built-in `/code-review` command and its reviewers can run these hunts. Apply the rest of this skill to what they find.

## 4. Verify every finding

No candidate reaches the author until a check that didn't find it agrees that it's real. In Claude Code, give each candidate to three subagents that try to prove it wrong: they read the cited line, its callers, and its tests, and answer "confirmed" or "not a bug" with a reason. Keep it only when at least two confirm it. Without subagents, verify each candidate in a fresh pass whose job is to disprove it. The article doesn't give a threshold, so two of three is this template's choice.

Drop, even when true:

- Style and formatting. Prettier and the linter own them.
- Diagnostics: warnings the compiler or linter already reports, and requests to add a log or a comment.
- Cleanup that fixes no bug: renames, refactors, simpler code. Those belong to `clean-code` when the author asks.
- Anything already reported in an earlier round, or closed with a reason.

## 5. Tag and report

| Tag          | Means                                                                                                                                    | Blocks |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Important    | The change breaks behavior, data, security, or its own intent, or a check fails                                                          | Yes    |
| Nit          | A real, small problem worth fixing. At most three per review unless `REVIEW.md` sets another cap: keep the most useful                   | No     |
| Pre-existing | A real bug that the change didn't introduce (check with `git blame`). Report it so it gets fixed on its own, never as the author's fault | No     |

Write the report in this order:

1. **A count first:** "2 Important, 1 Nit, 1 Pre-existing." When nothing survives verification, write "No findings. Nothing to fix." and stop there.
2. **The findings, most severe first.** Each one gives its tag, `path:line`, one sentence on what fails, the input or state that makes it fail, and the fix.
3. **The class of bug.** Name it ("a subscription that's never closed", "a query without an ownership check") and list every place it appears, so the author fixes the class, not one line.
4. **The risk tier** from [Scale human review to risk](#7-scale-human-review-to-risk), and what the owner should read.

## 6. Resolve every finding, and stop going in circles

- **Answer every finding:** fix it, or close it with a one-line reason (intended, wrong, or doesn't matter). An open Important finding blocks the commit or merge.
- **Review again after the fixes.** From the third review of the same change, review only what changed since the last review, and never repeat a finding already reported.
- **Stop after three rounds.** If the third review still finds an Important problem, don't start a fourth. Tell the user what keeps breaking and suggest rethinking the approach.

## 7. Scale human review to risk

| Tier   | Changes                                                                                                                                      | Before it ships                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Low    | Docs written for people, copy, tests only, or an additive change behind a flag                                                               | No human approval, once the checks pass and no Important finding is open                                       |
| Medium | Ordinary product changes, and agent instructions, which the article ranks with system prompts                                                | One person. The user directing you counts, once they've seen the checks' output and the findings               |
| High   | The high-risk paths in `REVIEW.md`, and sign-in, access rules, data access, migrations, payments, secrets, CI workflows, and deploy settings | Two people where the team has two. In a one-person repository, the owner reads the diff, not only your summary |

- An agent's review never counts as a human approval, including this skill's "No findings."
- An approval covers one commit. New commits need a new look.
- For a high-risk change, show the user the diff and the evidence, and wait for their approval before you push or merge, even when they asked for the whole job earlier.

## 8. Run a security review

Every change that touches sign-in, access rules, data access, user input, secrets, dependencies, or CI also gets a separate security pass. In Claude Code, run `/security-review`. Elsewhere, run a fresh pass with only the security lens. Its open findings block like Important ones. Close a false positive with a short reason.

## 9. Say how it was tested and how to undo it

- **In a pull request**, the description has three sections: **Testing** (the commands you ran and their results), **Risk** (the tier and why), and **How to revert**.
- **In a commit straight to `main`**, keep the repository's message conventions, and say in the body how the change was tested.
- **When undoing takes more than `git revert`** (a migration, stored data, a flag, a secret), write down the extra steps.

## Sweep existing code

When the user asks to review a whole repository or folder, with no diff:

- **Where to start:** the high-risk paths in `REVIEW.md`, then the files changed in the last 30 days (`git log --since=30.days --name-only`).
- **What to check against:** there is no intent to compare with, so check the code against `APP.md`, the README, and the tests' descriptions of the behavior.
- **Tags:** everything found is pre-existing, so use Important and Nit only.
- **How much to report:** at most ten findings per sweep, most severe first, verified like any other.
- **What not to do:** a sweep reports. Fix nothing until the user picks which findings to fix.

## When a review misses something

When a bug ships that a review should have caught, add what would have caught it: a test, a line under "What failure looks like here" in `REVIEW.md`, a rule in `APP.md`, or a check in CI. Record the commit under "Past misses" in `REVIEW.md`. When this skill changes, review those commits again and check that it finds each bug.
