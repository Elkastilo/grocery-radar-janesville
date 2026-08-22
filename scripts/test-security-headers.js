"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const { securityHeaders } = require("../src/securityHeaders");

const ROOT = path.join(__dirname, "..");
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) {
  if (error) reject(error);
  else resolve(this);
}));
const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.on("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const port = socket.address().port;
    socket.close(() => resolve(port));
  });
});

async function seedOwner(dataDir) {
  const db = new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite"));
  const now = new Date().toISOString();
  await run(db, "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT, password_hash TEXT, points INTEGER NOT NULL DEFAULT 0, accuracy_score INTEGER NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_super_admin INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)");
  await run(
    db,
    "INSERT INTO users (username,email,password_hash,is_email_verified,email_verified_at,created_at) VALUES ('elcastilo','juricbu@gmail.com',?,1,?,?)",
    [await bcrypt.hash("SecurityHeaderTest123!", 4), now, now]
  );
  await close(db);
}

async function startProductionServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-security-data-"));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-security-uploads-"));
  await seedOwner(dataDir);
  const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      UPLOADS_DIR: uploadsDir,
      SESSION_SECRET: "security-header-test-secret",
      PUBLIC_APP_URL: "https://thegroceryradar.com",
      ADMIN_PIN: "",
      EMAIL_TEST_MODE: "1",
      AI_API_KEY: "",
      OPENAI_API_KEY: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;

  for (let count = 0; count < 200; count += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: { "x-forwarded-proto": "https" }
      });
      if (response.ok) return { baseUrl, child, output };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  child.kill("SIGTERM");
  throw new Error(output.join(""));
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    server.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function assertProductionHeaders(response, label) {
  const csp = response.headers.get("content-security-policy") || "";
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains", `${label}: HSTS`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `${label}: frame protection`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${label}: MIME sniffing`);
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin", `${label}: referrer policy`);
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(self\)/, `${label}: same-origin admin barcode camera`);
  assert.match(response.headers.get("permissions-policy") || "", /microphone=\(\)/, `${label}: microphone disabled`);
  assert.match(response.headers.get("permissions-policy") || "", /geolocation=\(\)/, `${label}: geolocation disabled`);
  assert.match(csp, /default-src 'self'/, `${label}: default CSP`);
  assert.match(csp, /script-src 'self'/, `${label}: scripts`);
  assert.match(csp, /style-src 'self'/, `${label}: stylesheets`);
  assert.match(csp, /style-src-attr 'unsafe-inline'/, `${label}: existing dynamic style attributes only`);
  assert.match(csp, /img-src 'self' blob:/, `${label}: image previews`);
  assert.match(csp, /object-src 'none'/, `${label}: plugins disabled`);
  assert.match(csp, /base-uri 'self'/, `${label}: base URI`);
  assert.match(csp, /frame-ancestors 'none'/, `${label}: CSP frame protection`);
  assert.match(csp, /form-action 'self'/, `${label}: forms`);
  assert.doesNotMatch(csp, /unsafe-eval|\*/i, `${label}: no eval or wildcard source`);
  assert.equal(response.headers.get("x-powered-by"), null, `${label}: Express signature removed`);
}

async function assertDevelopmentDoesNotSendHsts() {
  const app = express();
  app.disable("x-powered-by");
  app.use(...securityHeaders({ production: false }));
  app.get("/", (request, response) => response.send("ok"));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(response.headers.get("strict-transport-security"), null, "Development HTTP must not receive HSTS.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const packageJson = require("../package.json");
  assert.equal(packageJson.scripts.start, "node server.js", "Render's npm start command must execute the tested server.js entry point.");

  const server = await startProductionServer();
  try {
    assert.match(server.output.join(""), /Security headers middleware enabled/, "Production startup must confirm security middleware registration.");
    for (const pathname of ["/", "/health", "/api/not-a-real-endpoint", "/admin"]) {
      const response = await fetch(`${server.baseUrl}${pathname}`, {
        headers: { "x-forwarded-proto": "https" },
        redirect: "manual"
      });
      assertProductionHeaders(response, pathname);
    }
  } finally {
    await stopServer(server);
  }
  await assertDevelopmentDoesNotSendHsts();
  console.log("Production security headers and development HSTS safety tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
