# Changelog

## [0.1.4](https://github.com/fohte/copier-update-action/compare/v0.1.3...v0.1.4) (2026-07-08)


### Features

* **per-block-resolve:** auto-resolve version-only conflicts left by mergiraf ([#33](https://github.com/fohte/copier-update-action/issues/33)) ([cde3e29](https://github.com/fohte/copier-update-action/commit/cde3e291cd715575cda165482c3404df9fcdc566))

## [0.1.3](https://github.com/fohte/copier-update-action/compare/v0.1.2...v0.1.3) (2026-07-07)


### Bug Fixes

* **per-block-resolve:** stop leaving mergiraf .orig backup files behind ([#29](https://github.com/fohte/copier-update-action/issues/29)) ([c1428c1](https://github.com/fohte/copier-update-action/commit/c1428c12dfc80672ad6a771d9dce46af88969acf))

## [0.1.2](https://github.com/fohte/copier-update-action/compare/v0.1.1...v0.1.2) (2026-07-01)


### Bug Fixes

* **per-block-resolve:** preserve mergiraf's per-key partial resolutions ([#23](https://github.com/fohte/copier-update-action/issues/23)) ([661e931](https://github.com/fohte/copier-update-action/commit/661e9314fdf851f3cb2a7e50c6776464977fbaa9))

## [0.1.1](https://github.com/fohte/copier-update-action/compare/v0.1.0...v0.1.1) (2026-06-30)


### Bug Fixes

* **per-block-resolve:** forward source file extension to mergiraf ([#18](https://github.com/fohte/copier-update-action/issues/18)) ([34a7c13](https://github.com/fohte/copier-update-action/commit/34a7c132e7cb49c4025dcde6b71160c0625c4796))

## 0.1.0 (2026-06-29)


### Features

* add target-version resolver ([#8](https://github.com/fohte/copier-update-action/issues/8)) ([eddd569](https://github.com/fohte/copier-update-action/commit/eddd569998df2eb67983ce9bab8913cf5a4f7bab))
* **conflicts:** add conflict marker file detector ([#9](https://github.com/fohte/copier-update-action/issues/9)) ([f1e3102](https://github.com/fohte/copier-update-action/commit/f1e3102d9583ea6e3041f1703f59e7cf53b8bc61))
* **conflicts:** add per-block conflict resolver ([#13](https://github.com/fohte/copier-update-action/issues/13)) ([8ccb4d8](https://github.com/fohte/copier-update-action/commit/8ccb4d83b52f41bd46ff327a9f4eb6f15cbf623e))
* **inputs:** add input reader and preflight validator ([#11](https://github.com/fohte/copier-update-action/issues/11)) ([66a1b79](https://github.com/fohte/copier-update-action/commit/66a1b79e3e986e192aabae6b10a5bd3eb0e92ad5))
* **mergiraf:** add installer module for pinned mergiraf release ([#12](https://github.com/fohte/copier-update-action/issues/12)) ([0ade022](https://github.com/fohte/copier-update-action/commit/0ade0225a1924e02004fe2924d2ca5b357fc43be))
* **orchestrator:** wire all modules through run() ([#14](https://github.com/fohte/copier-update-action/issues/14)) ([826c218](https://github.com/fohte/copier-update-action/commit/826c218d0079e4c4e494caa5b096447554049fcf))
