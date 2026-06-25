import { $ } from "bun";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";

const REPO = "AnakKucingTerbang/k8stui";

const PLATFORMS = [
  { name: "tui-linux-x64", binary: "k8stui-linux-x64" },
  { name: "tui-linux-arm64", binary: "k8stui-linux-arm64" },
  { name: "tui-linux-x64-musl", binary: "k8stui-linux-x64-musl" },
  { name: "tui-darwin-x64", binary: "k8stui-macos-x64" },
  { name: "tui-darwin-arm64", binary: "k8stui-macos-arm64" },
];

const rootPkgPath = resolve(import.meta.dir, "..", "package.json");
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
    checksums[asset.name] = asset.digest.replace("sha256:", "");
  }
}

for (const p of PLATFORMS) {
  if (!checksums[p.binary]) {
    console.error(`No SHA256 checksum found for ${p.binary} in release ${tag}`);
    process.exit(1);
  }
  console.log(`  ${p.binary}: ${checksums[p.binary]}`);
}
console.log("");

const platformPkgsDir = resolve(import.meta.dir, "..", "npm-packages", "@k8stui");
const stagingDir = mkdtempSync(join(tmpdir(), "k8stui-publish-"));

for (const p of PLATFORMS) {
  const pkgDir = join(platformPkgsDir, p.name);
  const pkgJsonPath = join(pkgDir, "package.json");
  const postinstallPath = join(pkgDir, "postinstall.js");

  if (!existsSync(pkgJsonPath)) {
    console.error(`Missing package.json at ${pkgJsonPath}`);
    process.exit(1);
  }

  const stageDir = join(stagingDir, p.name);
  mkdirSync(stageDir, { recursive: true });

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  pkg.version = version;

  writeFileSync(join(stageDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  const postinstallSrc = readFileSync(postinstallPath, "utf8");
  const stamped = postinstallSrc
    .replace(/"{{VERSION}}"/g, `"${version}"`)
    .replace(/"{{SHA256}}"/g, `"${checksums[p.binary]}"`);
  writeFileSync(join(stageDir, "postinstall.js"), stamped);

  console.log(`Publishing @k8stui/${p.name}@${version}...`);

  const npmCmd = dryRun
    ? `npm publish "${stageDir}" --dry-run --access public`
    : `npm publish "${stageDir}" --access public`;

  try {
    await $`${{ raw: npmCmd }}`.quiet();
    console.log(`  Published @k8stui/${p.name}@${version}`);
  } catch (e: any) {
    console.error(`  Failed to publish @k8stui/${p.name}@${version}: ${e.message}`);
    if (!dryRun) process.exit(1);
  }
}

console.log(`\nPublishing ${pkgName}@${version}...`);
const rootCmd = dryRun
  ? `npm publish . --dry-run --access public`
  : `npm publish . --access public`;

try {
  await $`${{ raw: rootCmd }}`.quiet();
  console.log(`  Published ${pkgName}@${version}`);
} catch (e: any) {
  console.error(`  Failed to publish ${pkgName}@${version}: ${e.message}`);
  if (!dryRun) process.exit(1);
}

console.log(`\nDone! All packages published for v${version}.`);