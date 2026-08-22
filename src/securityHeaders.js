"use strict";

const helmet = require("helmet");

const CONTENT_SECURITY_POLICY = Object.freeze({
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'none'"],
  imgSrc: ["'self'", "blob:"],
  manifestSrc: ["'self'"],
  mediaSrc: ["'self'", "blob:"],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'"],
  styleSrcAttr: ["'unsafe-inline'"],
  workerSrc: ["'self'"]
});

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=(self)",
  "camera=(self)",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "usb=()"
].join(", ");

function securityHeaders({ production = false } = {}) {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: CONTENT_SECURITY_POLICY
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: "deny" },
    hsts: production
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  });

  return [
    helmetMiddleware,
    (request, response, next) => {
      response.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
      next();
    }
  ];
}

module.exports = {
  CONTENT_SECURITY_POLICY,
  PERMISSIONS_POLICY,
  securityHeaders
};
