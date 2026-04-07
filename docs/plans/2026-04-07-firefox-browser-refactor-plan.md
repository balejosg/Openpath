# Firefox Browser Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify Firefox managed-extension resolution semantics across Linux and Windows, centralize Linux browser JSON mutation in one helper, and split Windows browser responsibilities into dedicated modules.

**Architecture:** Keep the platform-specific entrypoints stable while moving duplicated Firefox resolution semantics behind a shared contract. On Linux, move inline Python JSON mutation into a single helper script used by shell wrappers. On Windows, keep `Browser.psm1` as the import surface but delegate Firefox policy, native host, and diagnostics responsibilities to smaller modules.

**Tech Stack:** Bash, Python 3, PowerShell modules, BATS, Pester-oriented module layout, git

### Task 1: Add red tests for the shared Firefox resolver contract

**Files:**

- Modify: `tests/browser.bats`
- Modify: `tests/linux-e2e.bats`

**Step 1: Write the failing tests**

- Add a Linux test that asserts `resolve_firefox_managed_extension_policy` reports a stable key/value contract including `source`.
- Add a repository-structure test that asserts Windows exposes the same Firefox policy source semantics and that `Browser.psm1` delegates to helper modules.

**Step 2: Run tests to verify they fail**

Run: `bats OpenPath/tests/browser.bats OpenPath/tests/linux-e2e.bats`

Expected: failing assertions because the shared contract/module boundaries are not present yet.

**Step 3: Write the minimal implementation**

- Introduce the new contract shape in Linux and Windows.
- Add the module imports Windows will need after the split.

**Step 4: Run tests to verify they pass**

Run: `bats OpenPath/tests/browser.bats OpenPath/tests/linux-e2e.bats`

Expected: PASS

### Task 2: Centralize Linux browser JSON mutation behind one helper

**Files:**

- Create: `linux/libexec/browser-json.py`
- Modify: `linux/lib/browser.sh`
- Modify: `linux/lib/firefox-policy.sh`
- Modify: `linux/lib/common.sh`
- Modify: `linux/install.sh`
- Modify: `tests/browser.bats`
- Modify: `tests/linux-e2e.bats`

**Step 1: Write the failing tests**

- Add tests that assert Linux browser helpers invoke the shared JSON helper and that the installer/integrity baseline include it.

**Step 2: Run tests to verify they fail**

Run: `bats OpenPath/tests/browser.bats OpenPath/tests/linux-e2e.bats`

Expected: FAIL because the helper file and references do not exist yet.

**Step 3: Write the minimal implementation**

- Move Firefox policy mutation, Chromium policy generation, and manifest rewrites to `linux/libexec/browser-json.py`.
- Replace inline Python heredocs with helper invocations.
- Stage/install/checksum the helper like the other Linux runtime files.

**Step 4: Run tests to verify they pass**

Run: `bats OpenPath/tests/browser.bats OpenPath/tests/linux-e2e.bats`

Expected: PASS

### Task 3: Split Windows browser responsibilities into dedicated modules

**Files:**

- Create: `windows/lib/Browser.FirefoxPolicy.psm1`
- Create: `windows/lib/Browser.FirefoxNativeHost.psm1`
- Create: `windows/lib/Browser.Diagnostics.psm1`
- Modify: `windows/lib/Browser.psm1`
- Modify: `tests/linux-e2e.bats`

**Step 1: Write the failing tests**

- Add repository-structure tests that assert `Browser.psm1` imports the new modules and no longer owns the extracted functions directly.

**Step 2: Run tests to verify they fail**

Run: `bats OpenPath/tests/linux-e2e.bats`

Expected: FAIL because the split modules and imports do not exist yet.

**Step 3: Write the minimal implementation**

- Move Firefox policy resolution to `Browser.FirefoxPolicy.psm1`.
- Move native host state/artifact synchronization to `Browser.FirefoxNativeHost.psm1`.
- Move validation/diagnostic reporting helpers to `Browser.Diagnostics.psm1`.
- Keep `Browser.psm1` as the public import surface by importing helper modules and re-exporting the same commands.

**Step 4: Run tests to verify they pass**

Run: `bats OpenPath/tests/linux-e2e.bats`

Expected: PASS

### Task 4: Full verification and commit

**Files:**

- Modify: `docs/plans/2026-04-07-firefox-browser-refactor-plan.md` (only if implementation drift needs documenting)

**Step 1: Run targeted verification**

Run: `bats OpenPath/tests/browser.bats OpenPath/tests/linux-e2e.bats OpenPath/tests/openpath-update.bats`

Run: `bash -n OpenPath/linux/lib/browser.sh OpenPath/linux/lib/firefox-policy.sh OpenPath/linux/lib/firefox-managed-extension.sh OpenPath/linux/install.sh OpenPath/linux/lib/common.sh OpenPath/linux/scripts/runtime/openpath-update.sh`

**Step 2: Review staged diff**

Run: `git -C OpenPath diff --stat`

**Step 3: Commit**

Run: `git -C OpenPath commit -m "refactor(browser): unify firefox resolver helpers"`
