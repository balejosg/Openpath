# Browser Policy Spec And Test Split Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract shared browser PowerShell utilities, move browser policy payloads to a shared data-driven spec, and split the browser BATS suite by responsibility.

**Architecture:** Reduce duplication behind two new seams: a Windows `Browser.Common` module for browser-local helpers and a shared browser policy spec consumed by Linux and Windows. Replace the monolithic browser BATS file with multiple responsibility-focused `.bats` suites plus a shared support file.

**Tech Stack:** Bash, Python 3, PowerShell modules, JSON policy fixtures, BATS

### Task 1: Add red tests for the new seams

**Files:**

- Modify: `tests/linux-e2e.bats`
- Modify: `tests/browser_policy.bats`

**Step 1: Write the failing tests**

- Add a structure test that `Browser.psm1` imports `Browser.Common.psm1`.
- Add a structure test that Linux and Windows stage a shared browser policy spec file.
- Add a behavior test that `apply_search_engine_policies` can be driven by an overridden spec file.
- Add a structure test that browser tests are split into responsibility-focused suites.

**Step 2: Run tests to verify they fail**

Run: `bats OpenPath/tests/browser_policy.bats OpenPath/tests/linux-e2e.bats`

Expected: FAIL because the common module, shared spec references, and split suite structure do not exist yet.

### Task 2: Extract Windows browser-common helpers

**Files:**

- Create: `windows/lib/Browser.Common.psm1`
- Modify: `windows/lib/Browser.FirefoxPolicy.psm1`
- Modify: `windows/lib/Browser.FirefoxNativeHost.psm1`
- Modify: `windows/lib/Browser.psm1`
- Modify: `windows/lib/Common.psm1`

**Step 1: Write minimal implementation**

- Move shared browser-local helpers into `Browser.Common.psm1`.
- Import the new module from browser-focused modules.
- Track the new module in integrity coverage.

**Step 2: Run targeted tests**

Run: `bats OpenPath/tests/linux-e2e.bats`

Expected: PASS

### Task 3: Introduce a shared browser policy spec

**Files:**

- Create: `runtime/browser-policy-spec.json`
- Modify: `linux/libexec/browser-json.py`
- Modify: `linux/lib/common.sh`
- Modify: `linux/install.sh`
- Modify: `linux/scripts/build/build-deb.sh`
- Modify: `windows/lib/Browser.Common.psm1`
- Modify: `windows/lib/Browser.FirefoxPolicy.psm1`
- Modify: `windows/lib/Browser.psm1`
- Modify: `windows/Install-OpenPath.ps1`
- Modify: `tests/browser_policy.bats`
- Modify: `tests/linux-e2e.bats`

**Step 1: Write minimal implementation**

- Load the shared spec from a runtime-installed copy with source-tree fallback.
- Replace hardcoded Firefox and Chromium policy payload constants with spec-driven values.
- Copy the spec into Linux and Windows runtime locations.

**Step 2: Run targeted tests**

Run: `bats OpenPath/tests/browser_policy.bats OpenPath/tests/linux-e2e.bats`

Expected: PASS

### Task 4: Split browser tests by responsibility

**Files:**

- Create: `tests/browser_support.bash`
- Create: `tests/browser_policy.bats`
- Create: `tests/browser_firefox_extension.bats`
- Create: `tests/browser_chromium.bats`
- Create: `tests/browser_native_host.bats`
- Create: `tests/browser_support.bash`

**Step 1: Write minimal implementation**

- Move setup/teardown and helpers to `browser_support.bash`.
- Group tests by domain in separate `.bats` files.

**Step 2: Run targeted tests**

Run: `bats OpenPath/tests/browser_policy.bats OpenPath/tests/browser_firefox_extension.bats OpenPath/tests/browser_chromium.bats OpenPath/tests/browser_native_host.bats`

Expected: PASS

### Task 5: Verify and commit

**Step 1: Run verification**

Run: `bats OpenPath/tests/browser_policy.bats OpenPath/tests/browser_firefox_extension.bats OpenPath/tests/browser_chromium.bats OpenPath/tests/browser_native_host.bats OpenPath/tests/linux-e2e.bats OpenPath/tests/openpath-update.bats`

Run: `bash -n OpenPath/linux/lib/browser.sh OpenPath/linux/lib/firefox-policy.sh OpenPath/linux/lib/firefox-managed-extension.sh OpenPath/linux/lib/common.sh OpenPath/linux/install.sh OpenPath/linux/scripts/runtime/openpath-update.sh OpenPath/linux/scripts/build/build-deb.sh`

Run: `python3 -m py_compile OpenPath/linux/libexec/browser-json.py`

**Step 2: Review diff**

Run: `git -C OpenPath diff --stat`

**Step 3: Commit**

Run: `git -C OpenPath commit -m "refactor(browser): centralize policy spec and test support"`
