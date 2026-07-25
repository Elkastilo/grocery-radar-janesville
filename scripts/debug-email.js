require("dotenv").config();

const nodemailer = require("nodemailer");

const emailPasswordKey = ["EMAIL", "PASS"].join("_");
const rawPassword = String(process.env[emailPasswordKey] || "");
const trimmedPassword = rawPassword.trim();

function maskEmailUser(value) {
  const email = String(value || "").trim();
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email ? "Configured" : "";
  }

  return `${localPart.slice(0, Math.min(4, localPart.length))}***@${domain}`;
}

function redact(value) {
  const replacements = [
    rawPassword,
    trimmedPassword,
    String(process.env.EMAIL_USER || "").trim()
  ].filter(Boolean);
  let text = String(value || "");

  for (const replacement of replacements) {
    text = text.split(replacement).join("[redacted]");
  }

  return text;
}

function safeError(error) {
  if (!error) {
    return null;
  }

  return {
    code: redact(error.code || ""),
    command: redact(error.command || ""),
    responseCode: error.responseCode || null,
    response: redact(error.response || ""),
    message: redact(error.message || "")
  };
}

function suggestFix(error) {
  const details = safeError(error);
  const message = `${details?.code || ""} ${details?.responseCode || ""} ${details?.response || ""} ${details?.message || ""}`.toLowerCase();

  if (details?.responseCode === 535 || message.includes("535")) {
    return "Brevo rejected the SMTP username/password. Re-run npm run setup:email with the current Brevo SMTP key and confirm EMAIL_USER matches Brevo SMTP login.";
  }

  if (details?.code === "ETIMEDOUT" || message.includes("etimedout")) {
    return "Network or port timeout. Check EMAIL_HOST, EMAIL_PORT, firewall/VPN, and that port 587 is reachable.";
  }

  if (message.includes("self-signed") || message.includes("certificate") || message.includes("tls")) {
    return "TLS/certificate issue. For Brevo port 587, EMAIL_SECURE should usually be false.";
  }

  if (message.includes("sender") || message.includes("from") || message.includes("mail from")) {
    return "Sender/from issue. Check EMAIL_FROM and that the sender identity/domain is allowed in Brevo.";
  }

  return "Check the safe error object above, then verify Brevo SMTP login, key, sender identity, host, port, and secure settings.";
}

function printSafeConfig() {
  const startsWithWhitespace = /^\s/.test(rawPassword);
  const endsWithWhitespace = /\s$/.test(rawPassword);
  const trimmedChangedLength = rawPassword.length !== trimmedPassword.length;

  console.log("Safe email config:");
  console.log(JSON.stringify({
    EMAIL_HOST: String(process.env.EMAIL_HOST || "").trim(),
    EMAIL_PORT: Number(process.env.EMAIL_PORT || 0),
    EMAIL_SECURE: String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true",
    EMAIL_USER_MASKED: maskEmailUser(process.env.EMAIL_USER),
    EMAIL_FROM: String(process.env.EMAIL_FROM || "").trim(),
    ADMIN_NOTIFY_EMAIL: String(process.env.ADMIN_NOTIFY_EMAIL || "").trim(),
    APP_BASE_URL: String(process.env.APP_BASE_URL || "").trim(),
    smtpPasswordLength: rawPassword.length,
    smtpPasswordStartsWithWhitespace: startsWithWhitespace,
    smtpPasswordEndsWithWhitespace: endsWithWhitespace,
    smtpPasswordTrimmedLength: trimmedPassword.length,
    smtpPasswordTrimChangedLength: trimmedChangedLength
  }, null, 2));
}

function createTransporter() {
  return nodemailer.createTransport({
    host: String(process.env.EMAIL_HOST || "").trim(),
    port: Number(process.env.EMAIL_PORT || 0),
    secure: String(process.env.EMAIL_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: String(process.env.EMAIL_USER || "").trim(),
      pass: trimmedPassword
    }
  });
}

async function main() {
  printSafeConfig();

  if (!trimmedPassword) {
    console.log("Diagnostic result:");
    console.log(JSON.stringify({
      step: "config",
      ok: false,
      error: "SMTP password/key is missing."
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const transporter = createTransporter();

  try {
    console.log("Checking SMTP login with transporter.verify()...");
    await transporter.verify();
    console.log("transporter.verify() succeeded.");
  } catch (error) {
    console.log("transporter.verify() failed.");
    console.log(JSON.stringify({
      step: "verify",
      ok: false,
      error: safeError(error),
      suggestedFix: suggestFix(error)
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    console.log("Sending diagnostic test email...");
    const info = await transporter.sendMail({
      from: String(process.env.EMAIL_FROM || "").trim(),
      to: String(process.env.ADMIN_NOTIFY_EMAIL || "").trim(),
      subject: "Grocery Radar Janesville SMTP diagnostic",
      text: [
        "This is a direct SMTP diagnostic email from Grocery Radar Janesville.",
        "",
        "If you received this, Brevo SMTP login and sending are working.",
        "",
        `APP_BASE_URL: ${String(process.env.APP_BASE_URL || "").trim()}`,
        `Timestamp: ${new Date().toISOString()}`
      ].join("\n")
    });

    console.log("Diagnostic test email sent.");
    console.log(JSON.stringify({
      step: "send",
      ok: true,
      accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejected: Array.isArray(info.rejected) ? info.rejected.length : 0,
      response: redact(info.response || "")
    }, null, 2));
  } catch (error) {
    console.log("Diagnostic test email failed.");
    console.log(JSON.stringify({
      step: "send",
      ok: false,
      error: safeError(error),
      suggestedFix: suggestFix(error)
    }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log("Diagnostic failed before SMTP check.");
  console.log(JSON.stringify({
    step: "startup",
    ok: false,
    error: safeError(error)
  }, null, 2));
  process.exitCode = 1;
});
