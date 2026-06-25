#!/usr/bin/env node
"use strict";

var VERSION = "{{VERSION}}";
var PLATFORM = "linux-x64-musl";
var SHA256 = "{{SHA256}}";
var BASE_URL = "https://github.com/AnakKucingTerbang/k8stui/releases/download";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var https = require("https");

var url = BASE_URL + "/v" + VERSION + "/k8stui-" + PLATFORM;
var outPath = path.join(__dirname, "k8stui");

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
      if (digest !== SHA256) {
        try { fs.unlinkSync(outPath); } catch (_) {}
        console.error("k8stui postinstall: SHA256 mismatch");
        console.error("  expected: " + SHA256);
        console.error("  got:      " + digest);
        console.error("Download manually: " + url);
        process.exit(0);
      }
      try { fs.chmodSync(outPath, 0o755); } catch (_) {}
    });
  });

  stream.on("error", function (e) {
    console.error("k8stui postinstall: write failed: " + e.message);
    try { fs.unlinkSync(outPath); } catch (_) {}
    process.exit(0);
  });
});
