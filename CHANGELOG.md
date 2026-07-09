# Changelog

# [0.15.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.14.0...v0.15.0) (2026-07-09)


### Features

* **pages:** add [x] delete key and refresh on save ([4526c8e](https://github.com/AnakKucingTerbang/k8stui/commit/4526c8ecefb5ec6e092da6c9ac4dfe363b1fe3b1))

# [0.14.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.13.0...v0.14.0) (2026-07-09)


### Bug Fixes

* **env-editor:** support capital letters and symbols in .env input ([9e38bea](https://github.com/AnakKucingTerbang/k8stui/commit/9e38bea7cb62c5242db83c27be52087f273457d1))


### Features

* **env-editor:** add file-like paste via terminal bracketed paste ([f21bb9a](https://github.com/AnakKucingTerbang/k8stui/commit/f21bb9ad67da5160ef28eaa1729bc8d36b107480))

# [0.13.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.12.0...v0.13.0) (2026-07-04)


### Features

* **workload:** trigger CronJob manual job ([5cf458a](https://github.com/AnakKucingTerbang/k8stui/commit/5cf458afda534a1096ca224ec784805cd95bad45))

# [0.12.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.11.0...v0.12.0) (2026-07-02)


### Features

* **clipboard:** copy selection to clipboard on mouse release ([f30d0ae](https://github.com/AnakKucingTerbang/k8stui/commit/f30d0ae4d2a3cbd2bd05ee75b0997e93835860b0))

# [0.11.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.10.0...v0.11.0) (2026-07-01)


### Bug Fixes

* **rollout:** add 5s polling to WorkloadPage ([e2a89c3](https://github.com/AnakKucingTerbang/k8stui/commit/e2a89c30b8d5badfa54c6d3d38e5bc37a65b9f9b))


### Features

* **rollout:** add rollout restart for Deployments, DaemonSets, StatefulSets ([24fd7cc](https://github.com/AnakKucingTerbang/k8stui/commit/24fd7cc45028d69f2bc87d885b09b87571888841))

# [0.10.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.9.0...v0.10.0) (2026-06-30)


### Features

* **crd:** add custom resource detail page with YAML and metadata views ([ce9567a](https://github.com/AnakKucingTerbang/k8stui/commit/ce9567a08aaec75f08946ed4863fedd56b33c322))
* **crd:** add custom resource discovery view ([6a2d9c1](https://github.com/AnakKucingTerbang/k8stui/commit/6a2d9c163faa19888d134ab2a368a9810544b0a7))

# [0.9.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.8.0...v0.9.0) (2026-06-29)


### Features

* **portforward:** add port-forward feature for pod containers ([162e2d3](https://github.com/AnakKucingTerbang/k8stui/commit/162e2d3fff66fadd11eee0d774383d6c4821584c))

# [0.8.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.7.1...v0.8.0) (2026-06-28)


### Features

* **namespace:** add delete secret with .env cleanup option ([dfdb81a](https://github.com/AnakKucingTerbang/k8stui/commit/dfdb81a9d42f1040e63f15416946a3c5b44a18c8))

## [0.7.1](https://github.com/AnakKucingTerbang/k8stui/compare/v0.7.0...v0.7.1) (2026-06-26)


### Bug Fixes

* **ci:** simplify homebrew formula url and sha256 sed replacements ([25779d3](https://github.com/AnakKucingTerbang/k8stui/commit/25779d39c586a5f29619ad3b0a355fccfa41f2bc))

# [0.7.0](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.9...v0.7.0) (2026-06-26)


### Bug Fixes

* **ci:** add homebrew formula auto-update to release workflow ([74bc2a3](https://github.com/AnakKucingTerbang/k8stui/commit/74bc2a3841f247b7cc02f744a2de3120ad709cdb))
* **release:** disable npm publish in release-it config ([9f1a100](https://github.com/AnakKucingTerbang/k8stui/commit/9f1a100019f0329b87b51193edb78263a77cd8fc))


### Features

* **namespace:** add secret modal with kubectl and .env strategies ([633a7cc](https://github.com/AnakKucingTerbang/k8stui/commit/633a7cc2619776d8f88fab6c795ed915c5533403))

## [0.6.9](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.8...v0.6.9) (2026-06-25)


### Bug Fixes

* **workflow:** npm upgrade in release.yaml ([b587f5b](https://github.com/AnakKucingTerbang/k8stui/commit/b587f5bceb8160d619196cd8a3c6346709a54f92))

## [0.6.8](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.7...v0.6.8) (2026-06-25)


### Bug Fixes

* **npm:** use ./ prefix so npm treats staging dir as local path ([6a1c68d](https://github.com/AnakKucingTerbang/k8stui/commit/6a1c68d977d612baea89ccb8e8fc635aa49ddc8c))

## [0.6.7](https://github.com/AnakKucingTerbang/k8stui/compare/v0.6.6...v0.6.7) (2026-06-25)


### Bug Fixes

* **npm:** stage pkg in repo, publish with --provenance for OIDC ([1d7e93f](https://github.com/AnakKucingTerbang/k8stui/commit/1d7e93f20002e765bb15be1e99cfd90e6a829916))

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
