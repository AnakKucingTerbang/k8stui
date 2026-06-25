# Changelog

## [0.6.6](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.5...v0.6.6) (2026-06-25)


### Bug Fixes

* **npm:** rename postinstall.js to postinstall.cjs for CommonJS compat ([02d42de](https://github.com/AnakKucingTerbang/k8stui/commit/02d42de447ce097abb31cf61db0541716429a78d))

## [0.6.5](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.4...v0.6.5) (2026-06-25)


### Features

* **npm:** consolidate to single @k8stui/tui package with OIDC trusted publishing ([2923266](https://github.com/AnakKucingTerbang/k8stui/commit/29232669222b49fee319b515efdb70ccaf804ef1))

## [0.6.4](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.3...v0.6.4) (2026-06-25)


### Bug Fixes

* **ci:** explicit npm auth + verbose publish errors ([0c480ae](https://github.com/AnakKucingTerbang/k8stui/commit/0c480ae93f7a691da180141d7fb70159af4ebc2a))

## [0.6.3](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.2...v0.6.3) (2026-06-25)


### Bug Fixes

* **npm:** move runtime deps to devDependencies for CI builds ([69b3442](https://github.com/AnakKucingTerbang/k8stui/commit/69b3442156ac88e2b3703d21e0a4cb2eb0af4494))

## [0.6.2](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.1...v0.6.2) (2026-06-25)


### Bug Fixes

* **ui:** default to summary tab on secret page entry ([b4b806e](https://github.com/AnakKucingTerbang/k8stui/commit/b4b806e2c0e233e28e0c6edf99594796697eeea9))


### Features

* **npm:** add @k8stui/tui optional packages distribution ([846cddd](https://github.com/AnakKucingTerbang/k8stui/commit/846cdddf8d0b8c83b62fb48c07d8c80c09c91acd))

## [0.6.1](https://github.com/AnakKucingTerbang/k8stui/compare/v0.4.2...v0.6.1) (2026-06-25)


### Bug Fixes

* **sync:** atomic .env write, local kubectl apply, and ssh reliability fixes ([85f70aa](https://github.com/AnakKucingTerbang/k8stui/commit/85f70aac11987587c2e7e392dbed983d3ebd1055))

## [0.4.2](https://github.com/AnakKucingTerbang/k8stui/compare/v0.4.1...v0.4.2) (2026-06-24)


### Bug Fixes

* **install:** fix curl|bash pipe breaking interactive prompt and improve reliability ([dd43b4a](https://github.com/AnakKucingTerbang/k8stui/commit/dd43b4a631cb4e3e0c3b7c8a2796766c59e45af0))


### Features

* **distribution:** add cross-platform binary builds and GitHub Releases CI ([0beb016](https://github.com/AnakKucingTerbang/k8stui/commit/0beb016f3cd03513cfff23d03640e2992388fc12))

## [0.4.1](https://github.com/AnakKucingTerbang/k8stui/compare/v0.4.0...v0.4.1) (2026-06-24)


### Bug Fixes

* **ui:** make VIEWS sidebar highlight edge-to-edge like application/manifests boxes ([6a8061c](https://github.com/AnakKucingTerbang/k8stui/commit/6a8061ce032fc0351b1da46cf005ea9177ee34a1))

# [0.4.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.3.0...v0.4.0) (2026-06-23)


### Bug Fixes

* **cluster:** re-anchor selection to viewport after mouse scroll ([76d96ea](https://github.com/AnakKucingTerbang/k8stui/commit/76d96ea77fb5e9ab6063a86a888e5a3c6dd8004b))


### Features

* **cluster:** add namespace and resource views with sticky table headers ([8b0f287](https://github.com/AnakKucingTerbang/k8stui/commit/8b0f28720cea0b3a520b8fb9549380c97f4a2751))
* **nav:** add nav stack, namespace/resource detail pages, and node conditions view ([b80b894](https://github.com/AnakKucingTerbang/k8stui/commit/b80b894db6fb164c2dc2e239dd60231fed53178e))
* **secrets:** add dedicated SecretPage with two-column layout, lazy decode, and revealed keys scroll ([b7994b0](https://github.com/AnakKucingTerbang/k8stui/commit/b7994b01da089158cfd8dac8fe618fc182bc2882))

# 0.3.0 (2026-06-23)


### Bug Fixes

* each pod detail box owns its loading state ([09db820](https://github.com/AnakKucingTerbang/k8stui/commit/09db820f4dce2e39a6125da60a3f8889d0a693f1))
* enter key in pod view, viewport-limit YAML/kv rows, focus border highlights, toast copy text ([e74cc4c](https://github.com/AnakKucingTerbang/k8stui/commit/e74cc4c0a017e5cc4e56f535d9a19811fa9df310))
* overview bar label alignment, split node detail into bars+pods layout ([36634f6](https://github.com/AnakKucingTerbang/k8stui/commit/36634f6f0ada61e57010de4326f2c4ff7d2f68bc))
* **pkg:** convert bin to object format for npm compatibility ([d9a64f5](https://github.com/AnakKucingTerbang/k8stui/commit/d9a64f52f4b889b24237cbc9eb88ddea36612084))
* PVC/Secret/CM not showing in APPLICATION box ([e062127](https://github.com/AnakKucingTerbang/k8stui/commit/e062127fc3b7a783fcbd90cef8030afa545be1c4))
* replace .ts bin entry with static dist/cli.js for npm compatibility ([0dae09f](https://github.com/AnakKucingTerbang/k8stui/commit/0dae09fc28363e9b6ca681814969e661794843fb))


### Features

* add npm bin entry, curl|sh installer, and README ([fd04650](https://github.com/AnakKucingTerbang/k8stui/commit/fd04650fdba2ab50feb79d9759970f25bfaeac28))
* add SELECTED box to pod detail, fix [object Object] in values, remove redundant section titles ([433ba61](https://github.com/AnakKucingTerbang/k8stui/commit/433ba617ab9bc2067535ca0f348d8658fbddad60))
* **install:** add --uninstall flag and soften kubectl check ([7532490](https://github.com/AnakKucingTerbang/k8stui/commit/75324909077b133b185a7d80ec339dbe7a09ef26))
* **logs:** add live log streaming with horizontal scroll and wrap toggle ([749d223](https://github.com/AnakKucingTerbang/k8stui/commit/749d223f793fb088ea9bd2ea98ef1b3754015566))
* per-resource manifests in MANIFESTS box ([562f854](https://github.com/AnakKucingTerbang/k8stui/commit/562f85470624b7dba9c5ffb1bc0063d43fc759ca))
* pod detail page overhaul - box nav, loading, volume resolution ([54edc38](https://github.com/AnakKucingTerbang/k8stui/commit/54edc3820d5f11db7e664e3b47ba447bcbe20fa5))

## 0.1.1 (2026-06-22)


### Bug Fixes

* each pod detail box owns its loading state ([09db820](https://github.com/AnakKucingTerbang/k8stui/commit/09db820f4dce2e39a6125da60a3f8889d0a693f1))
* enter key in pod view, viewport-limit YAML/kv rows, focus border highlights, toast copy text ([e74cc4c](https://github.com/AnakKucingTerbang/k8stui/commit/e74cc4c0a017e5cc4e56f535d9a19811fa9df310))
* overview bar label alignment, split node detail into bars+pods layout ([36634f6](https://github.com/AnakKucingTerbang/k8stui/commit/36634f6f0ada61e57010de4326f2c4ff7d2f68bc))
* **pkg:** convert bin to object format for npm compatibility ([d9a64f5](https://github.com/AnakKucingTerbang/k8stui/commit/d9a64f52f4b889b24237cbc9eb88ddea36612084))
* PVC/Secret/CM not showing in APPLICATION box ([e062127](https://github.com/AnakKucingTerbang/k8stui/commit/e062127fc3b7a783fcbd90cef8030afa545be1c4))
* replace .ts bin entry with static dist/cli.js for npm compatibility ([0dae09f](https://github.com/AnakKucingTerbang/k8stui/commit/0dae09fc28363e9b6ca681814969e661794843fb))


### Features

* add npm bin entry, curl|sh installer, and README ([fd04650](https://github.com/AnakKucingTerbang/k8stui/commit/fd04650fdba2ab50feb79d9759970f25bfaeac28))
* add SELECTED box to pod detail, fix [object Object] in values, remove redundant section titles ([433ba61](https://github.com/AnakKucingTerbang/k8stui/commit/433ba617ab9bc2067535ca0f348d8658fbddad60))
* per-resource manifests in MANIFESTS box ([562f854](https://github.com/AnakKucingTerbang/k8stui/commit/562f85470624b7dba9c5ffb1bc0063d43fc759ca))
* pod detail page overhaul - box nav, loading, volume resolution ([54edc38](https://github.com/AnakKucingTerbang/k8stui/commit/54edc3820d5f11db7e664e3b47ba447bcbe20fa5))

All notable changes to this project will be documented in this file. See [release-it](https://github.com/release-it/release-it) and [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) for more.
