"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();
const { runRestoreDrill } = require("./restore-drill");

const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-radar-backup-fixture-"));
const fixturePath = path.join(fixtureDirectory, "backup.sqlite");
const database = new sqlite3.Database(fixturePath);
const exec = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve()));
const close = () => new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));

(async () => {
  await exec("CREATE TABLE products (id INTEGER PRIMARY KEY); CREATE TABLE stores (id INTEGER PRIMARY KEY); CREATE TABLE price_reports (id INTEGER PRIMARY KEY); CREATE TABLE proof_submissions (id INTEGER PRIMARY KEY); INSERT INTO products DEFAULT VALUES; INSERT INTO stores DEFAULT VALUES;");
  await close();
  const original = fs.readFileSync(fixturePath);
  const result = await runRestoreDrill(fixturePath);
  assert.equal(result.integrity, "ok");
  assert.equal(result.counts.products, 1);
  assert.equal(result.counts.stores, 1);
  assert.notEqual(path.resolve(result.restored_path), path.resolve(fixturePath));
  assert.deepEqual(fs.readFileSync(fixturePath), original);
  console.log("Disposable restore drill tests passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
