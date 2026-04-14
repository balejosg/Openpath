import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { app } from '../src/server.js';

export interface DirectServerHarness {
  baseUrl: string;
  close: () => Promise<void>;
}

export function startDirectServerHarness(): DirectServerHarness {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    close: () => closeServer(server),
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
