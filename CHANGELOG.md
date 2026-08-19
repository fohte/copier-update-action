# Changelog

## [0.1.6](https://github.com/fohte/copier-update-action/compare/v0.1.5...v0.1.6) (2026-08-19)


### Features

* **conflicts:** resolve package.json conflicts key by key ([#62](https://github.com/fohte/copier-update-action/issues/62)) ([917dae7](https://github.com/fohte/copier-update-action/commit/917dae75bd67055cae2d4153a51a4c1fe150a14c))


### Bug Fixes

* **conflicts:** require a full-line match for marker detection ([#61](https://github.com/fohte/copier-update-action/issues/61)) ([296d14a](https://github.com/fohte/copier-update-action/commit/296d14a8c79114e1b3f3e5e5bc4ac4dfdd5a39b8))
* **version-conflict:** log semver resolution only when a version was actually adopted ([#60](https://github.com/fohte/copier-update-action/issues/60)) ([4bd6d59](https://github.com/fohte/copier-update-action/commit/4bd6d5949fa6491fa98a95b4faf9734194227de4))
* **version-conflict:** reject version pairs with mismatched pin operators ([#59](https://github.com/fohte/copier-update-action/issues/59)) ([b93a19f](https://github.com/fohte/copier-update-action/commit/b93a19f940393505a92a356a5aa3cd75d986104d))
* **version-conflict:** sync tests with the object return shape ([#64](https://github.com/fohte/copier-update-action/issues/64)) ([b3e36bd](https://github.com/fohte/copier-update-action/commit/b3e36bdd1dddc833b4902e2960c261b1b5808e6a))

## [0.1.5](https://github.com/fohte/copier-update-action/compare/v0.1.4...v0.1.5) (2026-08-01)


### Features

* **mergiraf:** cache the mergiraf binary via GitHub Actions cache ([#56](https://github.com/fohte/copier-update-action/issues/56)) ([5eb5429](https://github.com/fohte/copier-update-action/commit/5eb5429ec30fd65a84ce2579ae72930e0f26cc23))


### Bug Fixes

* **conflicts:** scope conflict detection to changed files ([#43](https://github.com/fohte/copier-update-action/issues/43)) ([5e6b168](https://github.com/fohte/copier-update-action/commit/5e6b168c207e1aad594b6e21d6fa56195bf65623))

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
