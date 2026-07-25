const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.resolve(process.env.CLIENT_DIST_DIR || path.join(rootDir, "public-tailwind-dist"));

function isClientDir(candidate) {
  return Boolean(candidate) &&
    fs.existsSync(path.join(candidate, "package.json")) &&
    fs.existsSync(path.join(candidate, "src"));
}

function findClientDir() {
  const configured = process.env.CLIENT_DIR || process.env.TAILWIND_APP_DIR;

  if (configured) {
    return path.resolve(configured);
  }

  const candidates = [
    path.join(rootDir, "client"),
    path.join(rootDir, "..", "client"),
    path.join(rootDir, "..", "grocery-radar-tailwind-prototype")
  ];

  return candidates.find(isClientDir) || "";
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function copyDirectory(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

const clientDir = findClientDir();

if (!clientDir || !isClientDir(clientDir)) {
  if (fs.existsSync(path.join(outputDir, "index.html"))) {
    console.log(`No Tailwind client source found. Reusing existing build at ${path.relative(rootDir, outputDir)}.`);
    process.exit(0);
  }

  console.error([
    "Tailwind client source was not found.",
    "Set CLIENT_DIR to the Tailwind app folder, or place the frontend at ./client before running npm run build:client."
  ].join("\n"));
  process.exit(1);
}

console.log(`Building Tailwind client from ${clientDir}`);
run("npm", ["install"], clientDir);
run("npm", ["run", "build"], clientDir);

const sourceDist = path.join(clientDir, "dist");

if (!fs.existsSync(path.join(sourceDist, "index.html"))) {
  console.error(`Tailwind build did not create ${path.join(sourceDist, "index.html")}`);
  process.exit(1);
}

copyDirectory(sourceDist, outputDir);
console.log(`Copied Tailwind build to ${outputDir}`);
