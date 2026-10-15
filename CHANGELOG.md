# Changelog

## [1.1.4](https://github.com/LautaroBlasco23/life-tracker/compare/v1.1.3...v1.1.4) (2026-10-14)


### Miscellaneous Chores

* **deps:** bump docker/login-action from 3.7.0 to 4.6.0 ([#39](https://github.com/LautaroBlasco23/life-tracker/issues/39)) ([b7f1a48](https://github.com/LautaroBlasco23/life-tracker/commit/b7f1a481ae68e7dae4a19491d5dfdbb9cf99d776))

## [1.1.3](https://github.com/LautaroBlasco23/life-tracker/compare/v1.1.2...v1.1.3) (2026-10-14)


### Miscellaneous Chores

* **deps-dev:** bump jest from 29.7.0 to 30.5.2 ([#10](https://github.com/LautaroBlasco23/life-tracker/issues/10)) ([5c87738](https://github.com/LautaroBlasco23/life-tracker/commit/5c877384455e45b3dfa520b78ced28a551743b6b))
* **deps-dev:** bump lint-staged from 16.2.3 to 17.6.0 in /frontend ([#18](https://github.com/LautaroBlasco23/life-tracker/issues/18)) ([1c6bebe](https://github.com/LautaroBlasco23/life-tracker/commit/1c6bebeeed629641fa4c2480fe2ce59095b1ab33))
* **deps:** bump @vercel/analytics from 1.5.0 to 2.0.1 in /frontend ([#16](https://github.com/LautaroBlasco23/life-tracker/issues/16)) ([3a7d7d0](https://github.com/LautaroBlasco23/life-tracker/commit/3a7d7d0d1c9b801db5d0f8de2a7ad41915113a32))
* **deps:** bump actions/checkout from 4.4.0 to 7.0.1 ([#5](https://github.com/LautaroBlasco23/life-tracker/issues/5)) ([1e03870](https://github.com/LautaroBlasco23/life-tracker/commit/1e03870a32ba22020c4585168fcc1445e38c817e))
* **deps:** bump actions/setup-node from 4.4.0 to 7.1.0 ([#3](https://github.com/LautaroBlasco23/life-tracker/issues/3)) ([15c757e](https://github.com/LautaroBlasco23/life-tracker/commit/15c757e80d292a77e639d676beb9609543077e23))
* **deps:** bump actions/upload-artifact from 4.6.2 to 7.0.2 ([#4](https://github.com/LautaroBlasco23/life-tracker/issues/4)) ([b917c41](https://github.com/LautaroBlasco23/life-tracker/commit/b917c41f67686872b3e571e2a1d2d860f8422e69))
* **deps:** bump alpine from 3.22 to 3.24 in /backend ([#7](https://github.com/LautaroBlasco23/life-tracker/issues/7)) ([3645fc3](https://github.com/LautaroBlasco23/life-tracker/commit/3645fc326b8312d33f8c247790407c88b27db6da))
* **deps:** bump docker/build-push-action from 5.4.0 to 7.4.0 ([#2](https://github.com/LautaroBlasco23/life-tracker/issues/2)) ([9d3b7f2](https://github.com/LautaroBlasco23/life-tracker/commit/9d3b7f2e4f8bbae180b0c557a20dcb4096c2d58c))
* **deps:** bump docker/setup-buildx-action from 3.12.0 to 4.4.1 ([#6](https://github.com/LautaroBlasco23/life-tracker/issues/6)) ([021f42f](https://github.com/LautaroBlasco23/life-tracker/commit/021f42fe669595b83b582574f28359e65bdcb40b))
* **deps:** bump golang from 1.26-alpine to 1.27-alpine in /backend ([#8](https://github.com/LautaroBlasco23/life-tracker/issues/8)) ([7d88e58](https://github.com/LautaroBlasco23/life-tracker/commit/7d88e582b0bef88fa0442569582c634b88a7494e))
* **deps:** bump tailwind-merge from 2.6.0 to 3.7.0 in /frontend ([#19](https://github.com/LautaroBlasco23/life-tracker/issues/19)) ([c3d95fa](https://github.com/LautaroBlasco23/life-tracker/commit/c3d95fa2657d7827d3d7aa9f8cf05d52eecbbb92))
* **deps:** bump the go-minor-patch group across 1 directory with 13 updates ([#14](https://github.com/LautaroBlasco23/life-tracker/issues/14)) ([91052b1](https://github.com/LautaroBlasco23/life-tracker/commit/91052b130ef34c0f77806b4021c4ed70e9793511))
* **frontend:** bump prettier to 3.9.10 and reformat flagged files ([#36](https://github.com/LautaroBlasco23/life-tracker/issues/36)) ([06ee9c2](https://github.com/LautaroBlasco23/life-tracker/commit/06ee9c284e2786d4c21559bc0cd8483d471d967b))

## [1.1.2](https://github.com/LautaroBlasco23/life-tracker/compare/v1.1.1...v1.1.2) (2026-10-14)


### Miscellaneous Chores

* **frontend:** remove stale pnpm-lock.yaml failing prettier CI ([#33](https://github.com/LautaroBlasco23/life-tracker/issues/33)) ([cb64863](https://github.com/LautaroBlasco23/life-tracker/commit/cb648634f139d8a43edf69a55088e974a7c088b3))

## [1.1.1](https://github.com/LautaroBlasco23/life-tracker/compare/v1.1.0...v1.1.1) (2026-10-14)


### Code Refactoring

* deploy via root docker-compose.yml, remove infra/ and AWS-floci path ([#26](https://github.com/LautaroBlasco23/life-tracker/issues/26)) ([2306478](https://github.com/LautaroBlasco23/life-tracker/commit/2306478eec186cef5aab829741621568d819fd89))

## [1.1.0](https://github.com/LautaroBlasco23/life-tracker/compare/v1.0.0...v1.1.0) (2026-10-13)


### Features

* **notes:** add note groups with drag-and-drop ordering ([#20](https://github.com/LautaroBlasco23/life-tracker/issues/20)) ([0d20928](https://github.com/LautaroBlasco23/life-tracker/commit/0d20928e24710ddddcadb116183f26a1fdfc4bf9))
* **reminders:** single-section list, whole-day default window and date-aware filtering ([2e86673](https://github.com/LautaroBlasco23/life-tracker/commit/2e866734983a6da66b1434afa7810bc5380f193f))
* **security:** revocable sessions, rate limiting and endpoint hardening ([b23c0c6](https://github.com/LautaroBlasco23/life-tracker/commit/b23c0c6673fd7b2ad1632bc1e4a05ec85bffb48b))


### Bug Fixes

* **activities:** show completed reminders only on their due day with completion time ([70679dc](https://github.com/LautaroBlasco23/life-tracker/commit/70679dcb3407e3c6f48c4df30ad96b64c1763067))
* **security:** harden network exposure, secrets handling, and CI supply chain ([#24](https://github.com/LautaroBlasco23/life-tracker/issues/24)) ([70142f2](https://github.com/LautaroBlasco23/life-tracker/commit/70142f24710796a1e3c44729619ba230aacc52dd))


### Documentation

* add test improvement plan log ([e89e987](https://github.com/LautaroBlasco23/life-tracker/commit/e89e987763f6933f5bf41c73808e81e12fb76b14))
* update AGENTS.md with current repo layout and conventions ([f8343dd](https://github.com/LautaroBlasco23/life-tracker/commit/f8343dd2511647fbcf2c456ae8d5901744bd02b8))
