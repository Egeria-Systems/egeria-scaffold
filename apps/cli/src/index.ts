#!/usr/bin/env node

import { runCli } from "./run-cli.js";

process.exitCode = await runCli(process.argv.slice(2), {
  write: (value) => process.stdout.write(`${value}\n`),
  writeError: (value) => process.stderr.write(`${value}\n`),
});
