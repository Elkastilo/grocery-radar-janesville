#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { db } = require("../src/db");
const { APPLY_CONFIRMATION, previewCuratedBatch, applyCuratedBatch } = require("../src/curatedRetailerImport");

function argumentsFrom(argv) {
  const output = { file: "", mode: "dry-run", confirmation: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") output.file = argv[++index] || "";
    else if (value === "--dry-run") output.mode = "dry-run";
    else if (value === "--apply") output.mode = "apply";
    else if (value === "--confirm") output.confirmation = argv[++index] || "";
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!output.file) throw new Error("Use --file <batch.json>.");
  if (output.mode === "apply" && output.confirmation !== APPLY_CONFIRMATION) throw new Error(`--apply requires --confirm ${APPLY_CONFIRMATION}.`);
  return output;
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), options.file);
  const batch = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const result = options.mode === "apply" ? await applyCuratedBatch(batch, options.confirmation) : await previewCuratedBatch(batch);
  process.stdout.write(`${JSON.stringify({ mode: options.mode, file: filePath, confirmation_required_for_apply: APPLY_CONFIRMATION, ...result }, null, 2)}\n`);
  if (options.mode === "dry-run" && result.apply_blocked) process.exitCode = 2;
}

main().catch((error) => { process.stderr.write(`Curated import failed: ${error.message}\n`); process.exitCode = 1; }).finally(() => db.close());
