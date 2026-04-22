#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const requirements = [];
  const options = {
    pollSeconds: 30,
    repo: process.env.GITHUB_REPOSITORY ?? '',
    sha: '',
    timeoutMinutes: 90,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--repo' && next) {
      options.repo = next;
      index += 1;
      continue;
    }
    if (arg === '--sha' && next) {
      options.sha = next;
      index += 1;
      continue;
    }
    if (arg === '--require' && next) {
      const [workflowName, jobName] = next.split('::');
      if (!workflowName || !jobName) {
        throw new Error(`Invalid --require value "${next}". Expected "Workflow Name::Job Name".`);
      }
      requirements.push({ workflowName, jobName });
      index += 1;
      continue;
    }
    if (arg === '--timeout-minutes' && next) {
      options.timeoutMinutes = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--poll-seconds' && next) {
      options.pollSeconds = Number(next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (!options.repo) {
    throw new Error('GITHUB_REPOSITORY or --repo is required.');
  }
  if (!options.sha) {
    throw new Error('--sha is required.');
  }
  if (requirements.length === 0) {
    throw new Error('At least one --require "Workflow Name::Job Name" pair is required.');
  }
  if (!Number.isFinite(options.timeoutMinutes) || options.timeoutMinutes <= 0) {
    throw new Error('--timeout-minutes must be a positive number.');
  }
  if (!Number.isFinite(options.pollSeconds) || options.pollSeconds <= 0) {
    throw new Error('--poll-seconds must be a positive number.');
  }

  return { ...options, requirements };
}

function ghJson(args) {
  try {
    const output = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return JSON.parse(output);
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? '';
    const stdout = error.stdout?.toString?.() ?? '';
    throw new Error(`gh ${args.join(' ')} failed.\n${stderr || stdout || error.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function newestMatchingRun(runs, sha) {
  return runs
    .filter((run) => run.headSha === sha)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
}

async function waitForRequirement({ repo, sha, workflowName, jobName, timeoutAt, pollSeconds }) {
  while (Date.now() < timeoutAt) {
    // The gate first uses `gh run list` to find the same-SHA workflow run.
    const runs = ghJson([
      'run',
      'list',
      '--repo',
      repo,
      '--workflow',
      workflowName,
      '--commit',
      sha,
      '--limit',
      '20',
      '--json',
      'databaseId,status,conclusion,headSha,createdAt,url,workflowName',
    ]);
    const run = newestMatchingRun(runs, sha);

    if (!run) {
      console.log(`Waiting for ${workflowName} on ${sha}...`);
      await sleep(pollSeconds * 1000);
      continue;
    }

    // Then it uses `gh run view` to require the canonical summary job conclusion.
    const details = ghJson([
      'run',
      'view',
      String(run.databaseId),
      '--repo',
      repo,
      '--json',
      'status,conclusion,headSha,jobs,url,workflowName',
    ]);

    if (details.status !== 'completed') {
      console.log(`Waiting for ${workflowName} on ${sha}: ${details.status}`);
      await sleep(pollSeconds * 1000);
      continue;
    }

    if (details.conclusion !== 'success') {
      throw new Error(
        `${workflowName} completed with conclusion "${details.conclusion}" for ${sha}: ${details.url}`
      );
    }

    const job = details.jobs?.find((candidate) => candidate.name === jobName);
    if (!job) {
      throw new Error(`${workflowName} did not publish required summary job "${jobName}".`);
    }
    if (job.conclusion !== 'success') {
      throw new Error(
        `${workflowName} / ${jobName} concluded "${job.conclusion}" for ${sha}: ${details.url}`
      );
    }

    console.log(`Release gate satisfied: ${workflowName} / ${jobName} (${details.url})`);
    return;
  }

  throw new Error(`Timed out waiting for ${workflowName} / ${jobName} on ${sha}.`);
}

async function main() {
  const { repo, sha, requirements, timeoutMinutes, pollSeconds } = parseArgs(process.argv.slice(2));
  const timeoutAt = Date.now() + timeoutMinutes * 60 * 1000;

  for (const requirement of requirements) {
    await waitForRequirement({
      repo,
      sha,
      ...requirement,
      timeoutAt,
      pollSeconds,
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
