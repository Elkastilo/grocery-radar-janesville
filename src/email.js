const nodemailer = require("nodemailer");
const emailPasswordKey = ["EMAIL", "PASS"].join("_");
let lastDiagnosticResult = null;
const PRODUCTION_APP_BASE_URL = "https://thegroceryradar.com";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function emailConfig() {
  return {
    host: String(process.env.EMAIL_HOST || process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 0),
    secure: String(process.env.EMAIL_SECURE || process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: String(process.env.EMAIL_USER || process.env.SMTP_USER || "").trim(),
    pass: String(process.env[emailPasswordKey] || process.env.SMTP_PASS || "").trim(),
    from: String(
      process.env.EMAIL_FROM ||
        process.env.SMTP_FROM ||
        "Grocery Radar Janesville <no-reply@groceryradarjanesville.com>"
    ).trim()
  };
}

function appBaseUrl() {
  return String(
    process.env.PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      (isProduction() ? PRODUCTION_APP_BASE_URL : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

function emailTestMode() {
  return process.env.NODE_ENV === "test" && process.env.EMAIL_TEST_MODE === "1";
}

function adminNotifyEmail() {
  return String(process.env.ADMIN_NOTIFY_EMAIL || "").trim();
}

function maskEmailUser(value) {
  const email = String(value || "").trim();
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email ? "Configured" : "";
  }

  const visible = localPart.slice(0, Math.min(4, localPart.length));
  return `${visible}***@${domain}`;
}

function emailStatus() {
  const config = emailConfig();
  const missing = [];

  if (!config.host) {
    missing.push("Host");
  }

  if (!config.port) {
    missing.push("Port");
  }

  if (!config.user) {
    missing.push("User");
  }

  if (!config.pass) {
    missing.push("SMTP password/key");
  }

  if (!String(process.env.EMAIL_FROM || process.env.SMTP_FROM || "").trim()) {
    missing.push("From address");
  }

  if (!adminNotifyEmail()) {
    missing.push("Admin alerts email");
  }

  if (!String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || (isProduction() ? PRODUCTION_APP_BASE_URL : "")).trim()) {
    missing.push("Public app URL");
  }

  return {
    configured: missing.length === 0 || emailTestMode(),
    provider: emailTestMode() ? "Test" : "Brevo",
    adminNotifyEmail: adminNotifyEmail(),
    appBaseUrl: appBaseUrl(),
    technical: {
      hostConfigured: Boolean(config.host),
      portConfigured: Boolean(config.port),
      userConfigured: Boolean(config.user),
      passwordConfigured: Boolean(config.pass),
      maskedUser: maskEmailUser(config.user),
      from: config.from,
      missing
    }
  };
}

function smtpReady() {
  const config = emailConfig();
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

function createTransporter() {
  const config = emailConfig();

  if (!smtpReady()) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
}

function verificationUrlForToken(token) {
  return `${appBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

function safeEmailError() {
  return "Email could not be sent. Check SMTP setup in .env or Brevo.";
}

function redactSecretText(value) {
  const config = emailConfig();
  const replacements = [
    config.pass,
    config.user,
    process.env[emailPasswordKey],
    process.env.SMTP_PASS
  ].filter(Boolean);
  let text = String(value || "");

  for (const replacement of replacements) {
    text = text.split(replacement).join("[redacted]");
  }

  return text;
}

function safeSmtpErrorDetails(error) {
  if (!error) {
    return null;
  }

  return {
    code: redactSecretText(error.code || ""),
    command: redactSecretText(error.command || ""),
    responseCode: error.responseCode || null,
    response: redactSecretText(error.response || ""),
    message: redactSecretText(error.message || "")
  };
}

async function sendVerificationEmail(user, token) {
  const verificationLink = verificationUrlForToken(token);

  if (emailTestMode()) {
    return { sent: true, warning: null, test_mode: true };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Verification email not sent.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Verification email was not sent because SMTP email is not configured."
    };
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: user.email,
      subject: "Welcome to Grocery Radar Janesville — verify your email",
      text: [
        "Welcome to Grocery Radar Janesville.",
        "",
        "Please verify your email before rewards become available.",
        "",
        `Verification link: ${verificationLink}`,
        "",
        "If you did not create this account, you can ignore this email."
      ].join("\n")
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Verification email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Verification email could not be sent. Check server logs and SMTP settings."
    };
  }
}

async function sendAdminRegistrationEmail(user) {
  const adminEmail = adminNotifyEmail();

  if (!adminEmail) {
    console.log("Admin notification email not configured.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin notification email was not sent because ADMIN_NOTIFY_EMAIL is not configured."
    };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Admin notification email not sent.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin notification email could not be sent because SMTP email is not configured."
    };
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: adminEmail,
      subject: "New Grocery Radar Janesville user registered",
      text: [
        "A new user registered for Grocery Radar Janesville.",
        "",
        `Username: ${user.username}`,
        `Email: ${user.email}`,
        `User ID: ${user.id}`,
        `Registered: ${user.created_at}`,
        `Email verified: ${user.is_email_verified ? "Yes" : "No"}`,
        "",
        "Reward eligibility:",
        user.is_email_verified
          ? "Eligible for future gift card rewards."
          : "Not eligible for future gift card rewards until email is verified."
      ].join("\n")
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Admin notification email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin notification email could not be sent. Check server logs and SMTP settings."
    };
  }
}

async function sendReportRejectionEmail(user, report, rejection) {
  if (!user.email) {
    return { sent: false, warning: null };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Rejection email not sent.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Rejection email was not sent because SMTP email is not configured."
    };
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: user.email,
      subject: "Your Grocery Radar Janesville price report was rejected",
      text: [
        "Your Grocery Radar Janesville price report was rejected.",
        "",
        `Item: ${report.item_name}`,
        `Store: ${report.store_name || ""}`,
        `Submitted price: $${Number(report.price).toFixed(2)}`,
        `Rejection reason: ${rejection.reason}`,
        rejection.note ? `Admin note: ${rejection.note}` : "",
        "",
        "You can submit a corrected report if the information changes."
      ].filter(Boolean).join("\n")
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Rejection email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Rejection email could not be sent. Check server logs and SMTP settings."
    };
  }
}

async function sendAdminReportReviewEmail(report) {
  const adminEmail = adminNotifyEmail();

  if (!adminEmail) {
    console.log("Admin review notification email not configured.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin review notification email was not sent because ADMIN_NOTIFY_EMAIL is not configured."
    };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log("Admin review notification email not configured.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin review notification email could not be sent because SMTP email is not configured."
    };
  }

  const adminReviewLink = `${appBaseUrl()}/admin.html`;

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: adminEmail,
      subject: "New Grocery Radar price report needs review",
      text: [
        "A new Grocery Radar Janesville price report needs admin review.",
        "",
        `Item: ${report.item_name}`,
        `Brand: ${report.brand || "No brand entered"}`,
        `Store: ${report.store_name || ""}`,
        `Price: $${Number(report.price).toFixed(2)}`,
        `Package size: ${report.size_text || `${report.quantity} ${report.unit}`}`,
        `Proof type: ${report.proof_type}`,
        `Submitted by: ${report.username || ""}${report.user_email ? ` <${report.user_email}>` : ""}`,
        `Submitted: ${report.submitted_at}`,
        "",
        `Admin review link: ${adminReviewLink}`
      ].join("\n")
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Admin review notification email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Admin review notification email could not be sent. Check server logs and SMTP settings."
    };
  }
}

async function sendTestEmail(to) {
  const recipient = String(to || adminNotifyEmail()).trim();
  const transporter = createTransporter();

  if (!recipient) {
    return {
      sent: false,
      error: "A test email address is required."
    };
  }

  if (!transporter) {
    console.log("Email not configured. Test email not sent.");
    return {
      sent: false,
      error: "Email could not be sent. Check SMTP setup in .env or Brevo."
    };
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: recipient,
      subject: "Grocery Radar Janesville email test",
      text: [
        "This is a test email from Grocery Radar Janesville.",
        "",
        "If you received this, SMTP email is configured correctly.",
        "",
        `APP_BASE_URL: ${appBaseUrl()}`,
        `Timestamp: ${new Date().toISOString()}`
      ].join("\n")
    });

    return { sent: true, error: null };
  } catch (error) {
    console.error(`Test email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      error: safeEmailError(),
      details: safeSmtpErrorDetails(error)
    };
  }
}

async function runEmailDiagnostic(to) {
  const status = emailStatus();
  const recipient = String(to || adminNotifyEmail()).trim();
  const startedAt = new Date().toISOString();
  const baseResult = {
    started_at: startedAt,
    finished_at: "",
    provider: status.provider,
    configured: status.configured,
    adminNotifyEmail: status.adminNotifyEmail,
    maskedUser: status.technical.maskedUser,
    verify: { ok: false, error: null },
    send: { ok: false, error: null },
    suggestedFix: ""
  };

  if (!recipient) {
    baseResult.finished_at = new Date().toISOString();
    baseResult.suggestedFix = "Set ADMIN_NOTIFY_EMAIL before running diagnostics.";
    lastDiagnosticResult = baseResult;
    return baseResult;
  }

  const transporter = createTransporter();

  if (!transporter) {
    baseResult.finished_at = new Date().toISOString();
    baseResult.suggestedFix = "Run npm run setup:email and restart the app.";
    lastDiagnosticResult = baseResult;
    return baseResult;
  }

  try {
    await transporter.verify();
    baseResult.verify.ok = true;
  } catch (error) {
    baseResult.verify.error = safeSmtpErrorDetails(error);
    baseResult.finished_at = new Date().toISOString();
    baseResult.suggestedFix = smtpSuggestedFix(error);
    lastDiagnosticResult = baseResult;
    return baseResult;
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: recipient,
      subject: "Grocery Radar Janesville email diagnostic",
      text: [
        "This is an admin email diagnostic from Grocery Radar Janesville.",
        "",
        "If you received this, Brevo SMTP verify and send are working.",
        "",
        `APP_BASE_URL: ${appBaseUrl()}`,
        `Timestamp: ${new Date().toISOString()}`
      ].join("\n")
    });

    baseResult.send.ok = true;
    baseResult.suggestedFix = "Email diagnostics passed.";
  } catch (error) {
    baseResult.send.error = safeSmtpErrorDetails(error);
    baseResult.suggestedFix = smtpSuggestedFix(error);
  }

  baseResult.finished_at = new Date().toISOString();
  lastDiagnosticResult = baseResult;
  return baseResult;
}

function smtpSuggestedFix(error) {
  const details = safeSmtpErrorDetails(error);
  const message = `${details?.code || ""} ${details?.responseCode || ""} ${details?.response || ""} ${details?.message || ""}`.toLowerCase();

  if (details?.responseCode === 535 || message.includes("535")) {
    return "Brevo rejected the SMTP username/password. Re-run npm run setup:email with the current Brevo SMTP key, then restart the app.";
  }

  if (details?.code === "ETIMEDOUT" || message.includes("etimedout")) {
    return "Network or port timeout. Check Brevo host, port 587, and local network/firewall settings.";
  }

  if (message.includes("self-signed") || message.includes("certificate") || message.includes("tls")) {
    return "TLS issue. For Brevo port 587, EMAIL_SECURE should be false.";
  }

  if (message.includes("sender") || message.includes("from") || message.includes("mail from")) {
    return "Sender/from issue. Check EMAIL_FROM and Brevo sender identity.";
  }

  return "Check Brevo SMTP login, sender identity, host, port, and secure settings.";
}

function getLastEmailDiagnostic() {
  return lastDiagnosticResult;
}

async function sendAccountBanEmail(user, ban) {
  if (!user.email) {
    return { sent: false, warning: null };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.log("Email not configured. Ban email not sent.");
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Ban email was not sent because SMTP email is not configured."
    };
  }

  try {
    await transporter.sendMail({
      from: emailConfig().from,
      to: user.email,
      subject: "Your Grocery Radar Janesville account was banned",
      text: [
        "Your Grocery Radar Janesville account was banned.",
        "",
        `Username: ${user.username}`,
        `Reason: ${ban.reason}`,
        ban.note ? `Admin note: ${ban.note}` : "",
        "",
        "You cannot submit or verify prices while banned."
      ].filter(Boolean).join("\n")
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error(`Ban email failed: ${redactSecretText(error.message)}`);
    return {
      sent: false,
      warning: isProduction()
        ? null
        : "Ban email could not be sent. Check server logs and SMTP settings."
    };
  }
}

module.exports = {
  emailStatus,
  getLastEmailDiagnostic,
  runEmailDiagnostic,
  safeSmtpErrorDetails,
  verificationUrlForToken,
  sendTestEmail,
  sendVerificationEmail,
  sendAdminRegistrationEmail,
  sendAdminReportReviewEmail,
  sendReportRejectionEmail,
  sendAccountBanEmail
};
