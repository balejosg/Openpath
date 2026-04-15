import type { WebDriver } from 'selenium-webdriver';

export interface StudentPolicyDriverState {
  diagnosticsDir: string;
  driver: WebDriver | null;
  extensionUuid: string | null;
  getDriver(): WebDriver;
  getExtensionUuid(): string;
}
