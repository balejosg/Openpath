#!/usr/bin/env bash

set -euo pipefail

npx concurrently --group --names 'static,checks,security' 'npm:verify:static' 'npm:verify:checks' 'npm:verify:security'
npx concurrently --group --names 'coverage,unit' 'npm:verify:coverage' 'npm:verify:unit'
npm run e2e:full
