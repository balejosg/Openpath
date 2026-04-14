import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

interface ParsedArguments {
  testFiles: string[];
  watch: boolean;
}

function parseArguments(argv: string[]): ParsedArguments {
  const separatorIndex = argv.indexOf('--');
  const head = separatorIndex >= 0 ? argv.slice(0, separatorIndex) : argv;
  const tail = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : [];

  const testFiles: string[] = [];
  let watch = false;

  for (const arg of head) {
    if (arg === '--watch') {
      watch = true;
      continue;
    }

    testFiles.push(arg);
  }

  return {
    testFiles: [...testFiles, ...tail],
    watch,
  };
}

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address !== 'object') {
        server.close(() => {
          reject(new Error('Failed to allocate an ephemeral test port'));
        });
        return;
      }

      server.close((closeError) => {
        if (closeError != null) {
          reject(closeError);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function main(): Promise<void> {
  const { testFiles, watch } = parseArguments(process.argv.slice(2));

  if (testFiles.length === 0) {
    console.error(
      'Usage: tsx scripts/run-node-test-suite.ts [--watch] <test-file> [...more tests]'
    );
    process.exitCode = 1;
    return;
  }

  const port = String(await getAvailablePort());
  const testArgs = [
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=1',
    ...(watch ? ['--watch'] : ['--test-force-exit']),
    ...testFiles,
  ];

  const child = spawn(process.execPath, testArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: process.env.HOST ?? '127.0.0.1',
      NODE_ENV: 'test',
      PORT: port,
    },
    stdio: 'inherit',
  });

  child.once('error', (error) => {
    console.error(error);
    process.exit(1);
  });

  child.once('exit', (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

await main();
