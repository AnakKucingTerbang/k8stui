import { $ } from "bun";

await $`bun install --os="*" --cpu="*"`;

const targets = [
  {
    target: "bun-darwin-arm64",
    outfile: "dist/bin/k8stui-macos-arm64",
  },
  {
    target: "bun-darwin-x64",
    outfile: "dist/bin/k8stui-macos-x64",
  },
  {
    target: "bun-linux-x64",
    outfile: "dist/bin/k8stui-linux-x64",
    define: { "process.env.OPENTUI_LIBC": '"glibc"' },
  },
  {
    target: "bun-linux-x64-musl",
    outfile: "dist/bin/k8stui-linux-x64-musl",
    define: { "process.env.OPENTUI_LIBC": '"musl"' },
  },
  {
    target: "bun-linux-arm64",
    outfile: "dist/bin/k8stui-linux-arm64",
    define: { "process.env.OPENTUI_LIBC": '"glibc"' },
  },
];

for (const { target, outfile, define } of targets) {
  console.log(`Building ${target}...`);
  await Bun.build({
    entrypoints: ["./src/index.tsx"],
    outdir: ".",
    compile: {
      target,
      outfile,
    },
    define,
  });
  console.log(`✓ ${outfile}`);
}
