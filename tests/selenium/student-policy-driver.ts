import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert';

import { Builder, By, until, type WebDriver, type WebElement } from 'selenium-webdriver';
import * as firefox from 'selenium-webdriver/firefox';

import { waitForFirefoxExtensionUuid } from './firefox-extension-uuid';
import {
  buildPopupUrl,
  buildWindowsBlockedDnsCommand,
  buildWindowsHttpProbeCommand,
  DEFAULT_BLOCKED_TIMEOUT_MS,
  DEFAULT_EXTENSION_PATH,
  DEFAULT_POLL_MS,
  DEFAULT_TIMEOUT_MS,
  delay,
  ensureDirectory,
  escapeRegExp,
  FIREFOX_EXTENSION_ID,
  getDiagnosticsDir,
  getDisableSseCommand,
  getEnableSseCommand,
  getFixtureIpForHostname,
  getPolicyMode,
  getUpdateCommand,
  normalizeBoolean,
  normalizeWhitelistContents,
  optionalEnv,
  readWhitelistFile,
  runPlatformCommand,
  shellEscape,
  shouldSkipBundledExtension,
  isWindows,
} from './student-policy-env';
import type {
  BlockedScreenExpectation,
  ConvergenceOptions,
  DomainStatusPayload,
  OpenAndExpectBlockedOptions,
  OpenAndExpectLoadedOptions,
  RuntimeResponse,
  StudentPolicyDriverOptions,
  StudentScenario,
} from './student-policy-types';

async function discoverFirefoxExtensionUuid(profileDir: string): Promise<string> {
  return waitForFirefoxExtensionUuid({
    profileDir,
    extensionId: FIREFOX_EXTENSION_ID,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
}

export class StudentPolicyDriver {
  public readonly scenario: StudentScenario;

  public readonly diagnosticsDir: string;

  private readonly extensionPath: string;

  private readonly firefoxBinaryPath?: string;

  private readonly headless: boolean;

  private driver: WebDriver | null = null;

  private extensionUuid: string | null = null;

  public constructor(scenario: StudentScenario, options: StudentPolicyDriverOptions = {}) {
    this.scenario = scenario;
    this.diagnosticsDir =
      options.diagnosticsDir ??
      optionalEnv('OPENPATH_STUDENT_DIAGNOSTICS_DIR') ??
      getDiagnosticsDir();
    this.extensionPath =
      options.extensionPath ?? optionalEnv('OPENPATH_EXTENSION_PATH') ?? DEFAULT_EXTENSION_PATH;
    this.firefoxBinaryPath = options.firefoxBinaryPath ?? optionalEnv('OPENPATH_FIREFOX_BINARY');
    this.headless = options.headless ?? normalizeBoolean(optionalEnv('CI'), true);
  }

  public async setup(): Promise<void> {
    await ensureDirectory(this.diagnosticsDir);

    const options = new firefox.Options();
    if (!shouldSkipBundledExtension()) {
      options.addExtensions(this.extensionPath);
    }
    if (this.firefoxBinaryPath !== undefined) {
      options.setBinary(this.firefoxBinaryPath);
    }
    options.setPreference('network.dns.disablePrefetch', true);
    options.setPreference('dom.webnotifications.enabled', true);
    options.setPreference('extensions.experiments.enabled', true);

    if (this.headless) {
      options.addArguments('-headless');
    }

    this.driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
    await this.driver.manage().setTimeouts({ implicit: 2_000, pageLoad: 30_000, script: 15_000 });

    const capabilities = await this.driver.getCapabilities();
    const profileDir = capabilities.get('moz:profile') as string | undefined;
    if (profileDir !== undefined && profileDir !== '') {
      this.extensionUuid = await discoverFirefoxExtensionUuid(profileDir);
    }
  }

  public async teardown(): Promise<void> {
    if (this.driver !== null) {
      try {
        await this.driver.quit();
      } catch {
        // Best-effort cleanup. The browser process may already be gone.
      }
      this.driver = null;
    }
  }

  public async restart(): Promise<void> {
    await this.teardown();
    await this.setup();
  }

  public async ensureReady(): Promise<void> {
    if (this.driver === null) {
      await this.setup();
      return;
    }

    try {
      await this.driver.getTitle();
    } catch {
      this.driver = null;
      this.extensionUuid = null;
      await this.setup();
    }
  }

  public getDriver(): WebDriver {
    if (this.driver === null) {
      throw new Error('Firefox WebDriver is not initialized. Call setup() first.');
    }
    return this.driver;
  }

  public getExtensionUuid(): string {
    if (this.extensionUuid === null) {
      throw new Error('Extension UUID is not available; setup() must complete successfully first.');
    }
    return this.extensionUuid;
  }

  public async openAndExpectLoaded(options: OpenAndExpectLoadedOptions): Promise<void> {
    await this.withSessionRetry(async () => {
      const driver = this.getDriver();
      await driver.get(options.url);

      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      if (options.title !== undefined) {
        await driver.wait(until.titleContains(options.title), timeoutMs);
      }

      if (options.selector !== undefined) {
        await driver.wait(until.elementLocated(By.css(options.selector)), timeoutMs);
      }
    });
  }

  public async openAndExpectBlocked(options: OpenAndExpectBlockedOptions): Promise<void> {
    await this.withSessionRetry(async () => {
      const driver = this.getDriver();
      const timeoutMs = options.timeoutMs ?? DEFAULT_BLOCKED_TIMEOUT_MS;
      try {
        await driver.get(options.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes('about:neterror') ||
          message.includes('dnsNotFound') ||
          message.includes('NS_ERROR_UNKNOWN_HOST') ||
          message.includes('Reached error page')
        ) {
          return;
        }
        throw error;
      }

      if (options.forbiddenSelector !== undefined) {
        const found = await driver.wait(
          async () => {
            const elements = await driver.findElements(By.css(options.forbiddenSelector ?? 'body'));
            return elements.length === 0;
          },
          timeoutMs,
          `Expected selector ${options.forbiddenSelector} to remain absent for blocked page`
        );
        assert.strictEqual(found, true);
        return;
      }

      if (options.forbiddenText !== undefined) {
        const body = await driver.findElement(By.css('body'));
        const bodyText = await body.getText();
        assert.ok(!bodyText.includes(options.forbiddenText));
        return;
      }

      const pageSource = await driver.getPageSource();
      assert.ok(
        !pageSource.includes('id="page-status">ok<') &&
          !pageSource.includes('OpenPath Portal Fixture'),
        'Blocked navigation unexpectedly rendered the success markers'
      );
    });
  }

  public async waitForBlockedScreen(expectation: BlockedScreenExpectation = {}): Promise<void> {
    const driver = this.getDriver();
    const timeoutMs = expectation.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      const title = await driver.getTitle();
      return (
        currentUrl.includes('/blocked/blocked.html') ||
        currentUrl.includes('about:neterror?e=blockedByPolicy') ||
        title.includes('Blocked Page')
      );
    }, timeoutMs);

    const currentUrl = await driver.getCurrentUrl();
    if (currentUrl.includes('/blocked/blocked.html') && expectation.reasonPrefix !== undefined) {
      const url = new URL(currentUrl);
      const errorValue = url.searchParams.get('error') ?? '';
      assert.ok(
        errorValue.startsWith(expectation.reasonPrefix),
        `Expected blocked-screen error to start with ${expectation.reasonPrefix}, received ${errorValue}`
      );
    }
  }

  public async openAndExpectBlockedScreen(
    url: string,
    expectation: BlockedScreenExpectation = {}
  ): Promise<void> {
    await this.withSessionRetry(async () => {
      const driver = this.getDriver();
      try {
        await driver.get(url);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('blockedByPolicy') && !message.includes('Reached error page')) {
          throw error;
        }
      }

      await this.waitForBlockedScreen(expectation);
    });
  }

  public async waitForDomStatus(
    selector: string,
    expectedValue: string,
    options: ConvergenceOptions = {}
  ): Promise<void> {
    const driver = this.getDriver();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const element = await driver.wait(until.elementLocated(By.css(selector)), timeoutMs);
    await driver.wait(async () => {
      const text = (await element.getText()).trim();
      return text === expectedValue;
    }, timeoutMs);
  }

  public async assertDnsBlocked(hostname: string): Promise<void> {
    const command = isWindows()
      ? buildWindowsBlockedDnsCommand(hostname)
      : `sh -c "dig @127.0.0.1 ${hostname} +short +time=3 || true"`;

    const output = await runPlatformCommand(command);
    const normalized = output.trim();
    const fixtureIp = getFixtureIpForHostname(hostname);
    assert.ok(
      normalized === '' ||
        normalized === '0.0.0.0' ||
        (fixtureIp !== null && normalized !== fixtureIp),
      `Expected DNS for ${hostname} to be blocked, received: ${normalized}`
    );
  }

  public async assertDnsAllowed(hostname: string): Promise<void> {
    const command = isWindows()
      ? `powershell -NoLogo -Command "$result = Resolve-DnsName -Name '${hostname}' -Server 127.0.0.1 -DnsOnly -ErrorAction Stop; $result | Where-Object { $_.IPAddress } | ForEach-Object { $_.IPAddress }"`
      : `sh -c "dig @127.0.0.1 ${hostname} +short +time=3 || true"`;

    const output = await runPlatformCommand(command);
    const normalized = output.trim();
    const fixtureIp = getFixtureIpForHostname(hostname);
    assert.ok(
      normalized !== '' &&
        normalized !== '0.0.0.0' &&
        (fixtureIp === null || normalized === fixtureIp),
      `Expected DNS for ${hostname} to be allowed, received: ${normalized}`
    );
  }

  public async assertWhitelistContains(hostname: string): Promise<void> {
    const contents = normalizeWhitelistContents(await readWhitelistFile());
    assert.match(contents, new RegExp(`(^|\\n)${escapeRegExp(hostname)}($|\\n)`));
  }

  public async assertWhitelistMissing(hostname: string): Promise<void> {
    const contents = normalizeWhitelistContents(await readWhitelistFile());
    assert.doesNotMatch(contents, new RegExp(`(^|\\n)${escapeRegExp(hostname)}($|\\n)`));
  }

  public async refreshBlockedPathRules(): Promise<void> {
    const driver = this.getDriver();
    await this.openPopupContext();
    const result: { ok: boolean; value?: { success?: boolean; error?: string }; error?: string } =
      await driver.executeAsyncScript(
        `const done = arguments[arguments.length - 1];
       Promise.resolve(browser.runtime.sendMessage({ action: 'refreshBlockedPathRules', tabId: 0 }))
         .then((value) => done({ ok: true, value }))
         .catch((error) => done({ ok: false, error: String(error) }));`
      );

    if (!result.ok) {
      throw new Error(`Failed to refresh blocked-path rules: ${result.error ?? 'unknown error'}`);
    }

    if (result.value?.success !== true) {
      throw new Error(
        `Blocked-path refresh was rejected: ${result.value?.error ?? 'unknown runtime error'}`
      );
    }
  }

  public async forceLocalUpdate(): Promise<void> {
    await runPlatformCommand(getUpdateCommand());
  }

  public async withSseDisabled<T>(callback: () => Promise<T>): Promise<T> {
    await runPlatformCommand(getDisableSseCommand());
    try {
      return await callback();
    } finally {
      await runPlatformCommand(getEnableSseCommand());
    }
  }

  public async saveDiagnostics(name: string): Promise<void> {
    const driver = this.getDriver();
    const screenshotPath = path.join(this.diagnosticsDir, `${name}.png`);
    const htmlPath = path.join(this.diagnosticsDir, `${name}.html`);
    const jsonPath = path.join(this.diagnosticsDir, `${name}.json`);
    const screenshot = await driver.takeScreenshot();
    await fs.writeFile(screenshotPath, screenshot, 'base64');
    await fs.writeFile(htmlPath, await driver.getPageSource(), 'utf8');
    await fs.writeFile(
      jsonPath,
      JSON.stringify(
        {
          currentUrl: await driver.getCurrentUrl(),
          title: await driver.getTitle(),
          mode: getPolicyMode(),
        },
        null,
        2
      ),
      'utf8'
    );
  }

  public async find(selector: string): Promise<WebElement> {
    return this.getDriver().findElement(By.css(selector));
  }

  public async waitForConvergence(
    assertion: () => Promise<void>,
    options: ConvergenceOptions = {}
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    const deadline = Date.now() + timeoutMs;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      try {
        await assertion();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await delay(pollMs);
      }
    }

    throw lastError ?? new Error('Timed out waiting for convergence');
  }

  public async sendRuntimeMessage<T>(message: Record<string, unknown>): Promise<T> {
    const driver = this.getDriver();
    await this.openPopupContext();
    const result: { ok: boolean; value?: T; error?: string } = await driver.executeAsyncScript(
      `const [payload, done] = [arguments[0], arguments[arguments.length - 1]];
       Promise.resolve(browser.runtime.sendMessage(payload))
         .then((value) => done({ ok: true, value }))
         .catch((error) => done({ ok: false, error: String(error) }));`,
      message
    );

    if (!result.ok) {
      throw new Error(result.error ?? 'Unknown browser.runtime.sendMessage failure');
    }

    return result.value as T;
  }

  public async getActiveTabId(): Promise<number> {
    const driver = this.getDriver();
    await this.openPopupContext();
    const result: number | null = await driver.executeAsyncScript(
      `const done = arguments[arguments.length - 1];
       browser.tabs.query({ active: true, currentWindow: true })
         .then((tabs) => done(tabs[0]?.id ?? null))
         .catch(() => done(null));`
    );

    if (result === null) {
      throw new Error('Could not resolve active browser tab ID');
    }

    return result;
  }

  public async getDomainStatuses(): Promise<Record<string, DomainStatusPayload>> {
    const payload = await this.sendRuntimeMessage<RuntimeResponse<never>>({
      action: 'getDomainStatuses',
      tabId: await this.getActiveTabId(),
    });
    return payload.statuses ?? {};
  }

  public async getBlockedPathRulesDebug(): Promise<{
    version: string;
    count: number;
    rawRules: string[];
    compiledPatterns: string[];
  }> {
    const payload = await this.sendRuntimeMessage<RuntimeResponse<never>>({
      action: 'getBlockedPathRulesDebug',
      tabId: 0,
    });

    return {
      version: payload.version ?? '',
      count: payload.count ?? 0,
      rawRules: payload.rawRules ?? [],
      compiledPatterns: payload.compiledPatterns ?? [],
    };
  }

  public async getNativeBlockedPathsDebug(): Promise<{
    success: boolean;
    count: number;
    paths: string[];
    source?: string;
    error?: string;
  }> {
    const payload = await this.sendRuntimeMessage<RuntimeResponse<never>>({
      action: 'getNativeBlockedPathsDebug',
      tabId: 0,
    });

    return {
      success: payload.success === true,
      count: payload.count ?? 0,
      paths: (payload as RuntimeResponse<never> & { paths?: string[] }).paths ?? [],
      source: (payload as RuntimeResponse<never> & { source?: string }).source,
      error: payload.error,
    };
  }

  public async evaluateBlockedPathDebug(url: string, type: string): Promise<unknown> {
    const payload = await this.sendRuntimeMessage<RuntimeResponse<never> & { outcome?: unknown }>({
      action: 'evaluateBlockedPathDebug',
      tabId: 0,
      url,
      type,
    });

    return payload.outcome ?? null;
  }

  public async runCrossOriginFetchProbe(targetUrl: string): Promise<'ok' | 'blocked'> {
    const driver = this.getDriver();
    const result: 'ok' | 'blocked' = await driver.executeAsyncScript(
      `const [url, done] = [arguments[0], arguments[arguments.length - 1]];
       fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' })
         .then((response) => done(response.ok ? 'ok' : 'blocked'))
         .catch(() => done('blocked'));`,
      targetUrl
    );
    return result;
  }

  public async rerunPortalSubdomainProbe(): Promise<void> {
    const driver = this.getDriver();
    await driver.executeScript('return window.runSubdomainProbe && window.runSubdomainProbe();');
  }

  public async rerunIframeProbe(): Promise<void> {
    const driver = this.getDriver();
    await driver.executeScript('return window.runIframeProbe && window.runIframeProbe();');
  }

  public async rerunXhrProbe(): Promise<void> {
    const driver = this.getDriver();
    await driver.executeScript('return window.runXhrProbe && window.runXhrProbe();');
  }

  public async rerunFetchProbe(): Promise<void> {
    const driver = this.getDriver();
    await driver.executeScript('return window.runFetchProbe && window.runFetchProbe();');
  }

  public async assertHttpReachable(url: string): Promise<void> {
    const command = isWindows()
      ? buildWindowsHttpProbeCommand(url)
      : `curl -fsS ${shellEscape(url)} >/dev/null`;

    await runPlatformCommand(command);
  }

  public async assertHttpBlocked(url: string): Promise<void> {
    const command = isWindows()
      ? buildWindowsHttpProbeCommand(url)
      : `curl -fsS ${shellEscape(url)} >/dev/null`;

    try {
      await runPlatformCommand(command);
    } catch {
      return;
    }

    throw new Error(`Expected HTTP access to be blocked for ${url}`);
  }

  private async openPopupContext(): Promise<void> {
    const driver = this.getDriver();
    try {
      await driver.get(buildPopupUrl(this.getExtensionUuid()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Navigation timed out')) {
        throw error;
      }
    }
  }

  private async withSessionRetry<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('NoSuchSession')) {
        throw error;
      }

      await this.restart();
      return callback();
    }
  }
}
