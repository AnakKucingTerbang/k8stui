import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";

const REPO = "AnakKucingTerbang/k8stui";

const BINARY_TO_PLATFORM: Record<string, string> = {
  "k8stui-linux-x64": "linux_x64",
  "k8stui-linux-arm64": "linux_arm64",
  "k8stui-linux-x64-musl": "linux_x64_musl",
  "k8stui-macos-x64": "macos_x64",
  "k8stui-macos-arm64": "macos_arm64",
};

const rootDir = resolve(import.meta.dir, "..");
const rootPkgPath = join(rootDir, "package.json");
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
const version = rootPkg.version;
const tag = `v${version}`;
const dryRun = process.argv.includes("--dry-run");
const pkgName = rootPkg.name;

console.log(`Publishing ${pkgName}@${version} (tag: ${tag})${dryRun ? " [DRY RUN]" : ""}\n`);

const releaseUrl = `https://api.github.com/repos/${REPO}/releases/tags/${tag}`;
const releaseRes = await fetch(releaseUrl, {
  headers: { "User-Agent": "k8stui-publish-script" },
});

if (!releaseRes.ok) {
  console.error(`Failed to fetch release ${tag}: HTTP ${releaseRes.status}`);
  console.error(`Make sure the GitHub Release exists with binaries uploaded.`);
  process.exit(1);
}

const release = (await releaseRes.json()) as {
  assets: { name: string; digest: string }[];
};

const checksums: Record<string, string> = {};
for (const asset of release.assets) {
  if (asset.digest && asset.digest.startsWith("sha256:")) {
    const platform = BINARY_TO_PLATFORM[asset.name];
    if (platform) {
      checksums[platform] = asset.digest.replace("sha256:", "");
    }
  }
}

for (const [platform, sha] of Object.entries(checksums)) {
  console.log(`  ${platform}: ${sha}`);
}

const missingPlatforms = Object.values(BINARY_TO_PLATFORM).filter(
  (p) => !checksums[p]
);
if (missingPlatforms.length > 0) {
  console.error(
    `Missing SHA256 checksums for: ${missingPlatforms.join(", ")}`
  );
  console.error(`Make sure all binaries exist in release ${tag}`);
  process.exit(1);
}
console.log("");

const postinstallSrc = readFileSync(join(rootDir, "postinstall.js"), "utf8");
let stamped = postinstallSrc.replace(/"{{VERSION}}"/g, `"${version}"`);
for (const [platform, sha] of Object.entries(checksums)) {
  stamped = stamped.replace(`"{{SHA256_${platform}}}"`, `"${sha}"`);
}

const stagingDir = mkdtempSync(join(tmpdir(), "k8stui-publish-"));
mkdirSync(stagingDir, { recursive: true });

const stagingPostinstall = join(stagingDir, "postinstall.js");
writeFileSync(stagingPostinstall, stamped);

const stagingPkg = { ...rootPkg };
delete stagingPkg.scripts.postinstall;
stagingPkg.scripts = { ...stagingPkg.scripts, postinstall: "node postinstall.js" };
stagingPkg.files = ["bin/", "postinstall.js"];
writeFileSync(
  join(stagingDir, "package.json"),
  JSON.stringify(stagingPkg, null, 2) + "\n"
);

const binDir = join(stagingDir, "bin");
mkdirSync(binDir, { recursive: true });
writeFileSync(join(binDir, "k8stui"), readFileSync(join(rootDir, "bin", "k8stui")));

console.log(`Publishing ${pkgName}@${version}...`);

if (dryRun) {
  const result = Bun.spawnSync(
    ["npm", "publish", stagingDir, "--dry-run", "--access", "public"],
    { env: process.env, stdout: "inherit", stderr: "inherit" }
  );
  if (result.exitCode !== 0) {
    console.error(`  Failed (dry-run) ${pkgName}@${version} (exit ${result.exitCode})`);
  } else {
    console.log(`  Published ${pkgName}@${version} (dry-run)`);
  }
} else {
  const result = Bun.spawnSync(
    ["npm", "publish", stagingDir, "--access", "public"],
    { env: process.env, stdout: "inherit", stderr: "inherit" }
  );
  if (result.exitCode !== 0) {
    console.error(`  Failed to publish ${pkgName}@${version} (exit ${result.exitCode})`);
    process.exit(1);
  }
  console.log(`  Published ${pkgName}@${version}`);
}

console.log(`\nDone! ${pkgName}@${version} published.`);
