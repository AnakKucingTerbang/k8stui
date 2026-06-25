#!/usr/bin/env node
"use strict";

var VERSION = "{{VERSION}}";

var PLATFORM_MAP = {
  "darwin-x64": "macos-x64",
  "darwin-arm64": "macos-arm64",
  "linux-x64-musl": "linux-x64-musl",
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
};

var CHECKSUMS = {
  "macos-x64": "{{SHA256_macos_x64}}",
  "macos-arm64": "{{SHA256_macos_arm64}}",
  "linux-x64": "{{SHA256_linux_x64}}",
  "linux-arm64": "{{SHA256_linux_arm64}}",
  "linux-x64-musl": "{{SHA256_linux_x64_musl}}",
};

var BASE_URL = "https://github.com/AnakKucingTerbang/k8stui/releases/download";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var https = require("https");

function detectLibc() {
  if (process.platform !== "linux") return "";
  try {
    var child_process = require("child_process");
    var out = child_process.execFileSync("ldd", ["--version"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (out.indexOf("musl") !== -1) return "musl";
  } catch (e) {
    if (e && e.stderr && typeof e.stderr === "string" && e.stderr.indexOf("musl") !== -1) return "musl";
    try {
      var child_process2 = require("child_process");
      var out2 = child_process2.execSync("getconf GNU_LIBC_VERSION 2>/dev/null", {
        encoding: "utf8",
        timeout: 3000,
      });
      if (out2 && out2.indexOf("glibc") !== -1) return "";
    } catch (_) {}
  }
  return "";
}

function getPlatformKey() {
  var os = process.platform;
  var arch = process.arch;
  var libc = detectLibc();
  var suffix = libc === "musl" ? "-" + libc : "";
  return os + "-" + arch + suffix;
}

function follow(u, cb) {
  https.get(u, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return follow(res.headers.location, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error("HTTP " + res.statusCode + " for " + u));
    }
    cb(null, res);
  }).on("error", cb);
}

var key = getPlatformKey();
var platform = PLATFORM_MAP[key];
var sha256 = platform ? CHECKSUMS[platform] : null;

if (!platform || !sha256) {
  console.error("k8stui postinstall: unsupported platform " + key);
  console.error(
    "Install the standalone binary from: https://github.com/AnakKucingTerbang/k8stui"
  );
  process.exit(0);
}

var url = BASE_URL + "/v" + VERSION + "/k8stui-" + platform;
var outPath = path.join(__dirname, "k8stui");

console.log("k8stui: downloading binary for " + platform + "...");

follow(url, function (err, res) {
  if (err) {
    console.error("k8stui postinstall: download failed: " + err.message);
    console.error("Download manually: " + url);
    process.exit(0);
  }

  var hash = crypto.createHash("sha256");
  var stream = fs.createWriteStream(outPath);

  res.on("data", function (chunk) {
    hash.update(chunk);
  });

  res.pipe(stream);

  stream.on("finish", function () {
    stream.close(function () {
      var digest = hash.digest("hex");
      if (digest !== sha256) {
        try { fs.unlinkSync(outPath); } catch (_) {}
        console.error("k8stui postinstall: SHA256 mismatch");
        console.error("  expected: " + sha256);
        console.error("  got:      " + digest);
        console.error("Download manually: " + url);
        process.exit(0);
      }
      try { fs.chmodSync(outPath, 0o755); } catch (_) {}
      console.log("k8stui: installed " + platform + " binary");
    });
  });

  stream.on("error", function (e) {
    console.error("k8stui postinstall: write failed: " + e.message);
    try { fs.unlinkSync(outPath); } catch (_) {}
    process.exit(0);
  });
});
