import fs from 'node:fs';

import type { Express, Request, Response } from 'express';

import {
  getChromiumManagedCrxFile,
  getFirefoxReleaseXpiFile,
  getPublicBaseUrl,
  readChromiumManagedMetadata,
  readFirefoxReleaseMetadata,
} from '../lib/server-assets.js';

export function registerExtensionRoutes(app: Express): void {
  app.get('/api/extensions/firefox/openpath.xpi', (_req, res) => {
    if (!readFirefoxReleaseMetadata()) {
      res.status(404).type('text/plain').send('Firefox release extension package unavailable');
      return;
    }

    res.type('application/x-xpinstall').send(fs.readFileSync(getFirefoxReleaseXpiFile()));
  });

  app.get('/api/extensions/chromium/updates.xml', (req: Request, res: Response): void => {
    const metadata = readChromiumManagedMetadata();
    if (!metadata) {
      res.status(404).type('text/plain').send('Chromium managed extension unavailable');
      return;
    }

    const codebase = `${getPublicBaseUrl(req)}/api/extensions/chromium/openpath.crx`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="${metadata.extensionId}">
    <updatecheck codebase="${codebase}" version="${metadata.version}" />
  </app>
</gupdate>
`;

    res.type('application/xml').send(xml);
  });

  app.get('/api/extensions/chromium/openpath.crx', (_req, res) => {
    const chromiumManagedCrxFile = getChromiumManagedCrxFile();
    if (!fs.existsSync(chromiumManagedCrxFile)) {
      res.status(404).type('text/plain').send('Chromium managed extension package unavailable');
      return;
    }

    res.type('application/x-chrome-extension').send(fs.readFileSync(chromiumManagedCrxFile));
  });
}
