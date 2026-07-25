const fs = require("fs");
const path = require("path");
const readline = require("readline");

const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const emailPasswordKey = ["EMAIL", "PASS"].join("_");

const BREVO_SETTINGS = {
  EMAIL_HOST: "smtp-relay.brevo.com",
  EMAIL_PORT: "587",
  EMAIL_SECURE: "false",
  EMAIL_USER: "aea3cc001@smtp-brevo.com",
  EMAIL_FROM: "Grocery Radar Janesville <juricbu@gmail.com>",
  ADMIN_NOTIFY_EMAIL: "juricbu@gmail.com",
  APP_BASE_URL: "http://localhost:3000"
};

function serializeEnvValue(value) {
  const text = String(value || "");

  if (/^[A-Za-z0-9_@.:/-]+$/.test(text)) {
    return text;
  }

  return JSON.stringify(text);
}

function cleanSecret(value) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function parseExistingEnv(content) {
  const values = new Map();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (match) {
      values.set(match[1], true);
    }
  }

  return { lines, values };
}

function setEnvValue(content, key, value) {
  const { lines, values } = parseExistingEnv(content);
  const nextLine = `${key}=${serializeEnvValue(value)}`;
  let replaced = false;

  const updatedLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (match && match[1] === key) {
      replaced = true;
      return nextLine;
    }

    return line;
  });

  if (!replaced) {
    if (updatedLines.length && updatedLines[updatedLines.length - 1].trim() !== "") {
      updatedLines.push("");
    }

    if (!values.has(key)) {
      updatedLines.push(nextLine);
    }
  }

  return updatedLines.join("\n").replace(/\n*$/, "\n");
}

function writeEnv(updates) {
  let content = "";

  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf8");
  }

  const preservedDefaults = {
    PORT: "3000",
    ADMIN_PIN: "1234",
    SESSION_SECRET: "change_this_secret"
  };

  for (const [key, value] of Object.entries(preservedDefaults)) {
    if (!new RegExp(`^\\s*${key}\\s*=`, "m").test(content)) {
      content = setEnvValue(content, key, value);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    content = setEnvValue(content, key, value);
  }

  fs.writeFileSync(envPath, content, { mode: 0o600 });
}

function promptVisible(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptHidden(promptText) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";

    function cleanup() {
      stdin.removeListener("data", onData);

      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }

      stdin.pause();
    }

    function finish() {
      cleanup();
      stdout.write("\n");
      resolve(value);
    }

    function onData(chunk) {
      const text = chunk.toString("utf8");

      for (const char of text) {
        const code = char.charCodeAt(0);

        if (char === "\r" || char === "\n") {
          finish();
          return;
        }

        if (code === 3) {
          cleanup();
          stdout.write("\n");
          reject(new Error("Setup cancelled."));
          return;
        }

        if (code === 8 || code === 127) {
          value = value.slice(0, -1);
          continue;
        }

        if (code >= 32) {
          value += char;
        }
      }
    }

    stdout.write(promptText);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function promptForPassword() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    return promptHidden("Enter Brevo SMTP password/key: ");
  }

  console.log("Enter Brevo SMTP password/key. Input is read locally and will not be printed after saving.");
  return promptVisible("");
}

async function main() {
  const password = cleanSecret(await promptForPassword());

  if (!password) {
    console.error("Brevo SMTP password/key is required. No changes were saved.");
    process.exitCode = 1;
    return;
  }

  writeEnv({
    ...BREVO_SETTINGS,
    [emailPasswordKey]: password
  });

  console.log("Email settings saved. Restart the app with npm run dev, then send a test email from Admin > Email Setup.");
}

main().catch((error) => {
  console.error(error.message || "Email setup failed.");
  process.exitCode = 1;
});
