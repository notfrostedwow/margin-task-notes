# Current file manifest

The repaired local snapshot contains 40 tracked files. The 39 other files are listed below; this manifest omits its own hash to avoid a circular reference. SHA-256 values describe the current committed file contents, including unchanged original source and screenshot evidence.

The narrow repair changes only package.json, package-lock.json, tsconfig.json, playwright.config.ts, .github/workflows/checks.yml, README.md, this manifest and docs/verification.md, and adds docs/supabase-setup.md, docs/supabase-schema.sql and docs/supabase-policy-examples.sql. Runtime/UI source, license and baseline screenshots remain unchanged. The SQL files are documentation only: UNEXECUTED / NOT VERIFIED LIVE.

No dependency directories, downloaded browser binaries, build output, test traces, environment files or secrets are tracked.

| File                                        |  Bytes | SHA-256                                                          |
| ------------------------------------------- | -----: | ---------------------------------------------------------------- |
| .github/workflows/checks.yml                |    576 | 72831b285d49e5f6a395a0d017e5578148ced76be6b681c039ff6f80c6bd2d17 |
| .gitignore                                  |     87 | 479a2c23bb1f7149b7dd51536c4270760315ea799136305978d6b87a3009c76c |
| docs/react-research.md                      |   1640 | ac1fdd15d4f773403bfa29bddb77ee60a710c7c4afa41c0aef3e0157a2d7a086 |
| docs/screenshots/desktop-confirmation.png   | 118519 | 025c979793fb113a2fea38aa386d95f54af09d0ece275a9df38ad834dcea8474 |
| docs/screenshots/desktop-recovery.png       |  90134 | 95a8f36a99d828e9cd0a7019bd8c27f0b53bcd2e78a54e957c45d9f561795405 |
| docs/screenshots/desktop-workspace.png      |  91090 | 08b7473276d9dcb2a0751bac5f3fadc85e6f1f7f740036fa1fbf7ea60ce0cadd |
| docs/screenshots/desktop-workspace-full.png | 141955 | e74e3fd35af73e0b8c1b93f88c14752b757a5796c9ee13433012f0bc8e6b531f |
| docs/screenshots/mobile-confirmation.png    |  51630 | 63f3291a6abdcb83f5a1b59849766e46ae6574241a299a68b01eafbf2ef1e2d9 |
| docs/screenshots/mobile-notes.png           |  39771 | 69d5adb5dc2e4c7831e1aba28ee0092b498f2c52ef6da6307c2bc016cad8ab50 |
| docs/screenshots/mobile-recovery.png        |  56978 | 6ae56b13cf9cddfbd3d944d3d59e134200898edb815a6d9abae2695546c26e4c |
| docs/screenshots/mobile-workspace.png       |  43160 | 5c53145ed6707606c140c7db6e12c96492a177f082592138986f2e91211c604b |
| docs/screenshots/mobile-workspace-full.png  |  83903 | 845478b3e065c944ac0c6aae7bf0a9f1c5b36e4e1d9db31d1ef4018dacbfab9a |
| docs/supabase-policy-examples.sql           |  11678 | c47bd492c975ce3664212968f7db90e6d6af40644d763188d647edc949f60bc6 |
| docs/supabase-schema.sql                    |   5486 | 91045d03870310f1a4a33be7bee5c4d02ff49ce0965fd450f11de66310afad83 |
| docs/supabase-setup.md                      |   6947 | abfafccdde572152785de2fe12568497137dcdae46a7d0c712232c7fcc927e0b |
| docs/verification.md                        |  11421 | 34d655921e1fd05ec000b93ee4c1b5a2a359cf42766de82e93578b3c1c08c20d |
| eslint.config.js                            |    373 | 490461fc0331d12d4da02d6a0aa05410e4e03f389db94ad771a40aaa25c25158 |
| index.html                                  |    551 | 3c572ffb38b8978aa493cc8ee5b493dd74e07815aeff285bb6e22f1fc0358984 |
| LICENSE                                     |   1068 | 705afc6bc7a1faee4e40303255259bde4f25c8852534499c486d074f866af091 |
| package.json                                |   1055 | f4df3135500e7fb0a3ce947ed41f499487aba3c0b0878de5eed2c8bb54a52411 |
| package-lock.json                           | 104772 | 95b18f254ec3222ed5c308922fcec68c5a64d311908ff553cbf9a28d23dadb0a |
| playwright.config.ts                        |    951 | 2f57d2333ab45d594f77edbb6f67bf6bd4e2f3aca43ccf6a1bed200635aa6d00 |
| public/mark.svg                             |    190 | 2e7caee8a36d6a99e05f2c9e58cb512da97075c3d13b64bde41285afe1a23331 |
| README.md                                   |  11634 | 0720c72d165ac3d9d7211701c57ba5b6c825e7f2149c8652eb75dec9f434768d |
| scripts/offline.mjs                         |   1322 | 314176cf59de7d3313fe4766486796c74c4ca3db10bbc2785a3472185df7d90a |
| src/App.tsx                                 |  30164 | f8766f0ce975644a57e10799f9ffb6744218f1b665896b0087effcc706e5892b |
| src/demo.ts                                 |   3843 | ab13cd606a258f38ffc67b885f1b68c26976f2ad0272d891a1c03aea5b0bd9be |
| src/Dialog.tsx                              |   1863 | 8f874b069e64f6104aa3fcf0f8a0eb266ff0ddef4303dc759a25eab882550717 |
| src/domain.test.ts                          |  13135 | b88ad12c82c5be1a5921c3ee52c93c7182bd51a2605c87990f1c53e48c08d018 |
| src/domain.ts                               |  10433 | 613aa261cf2ef32871898cfa52e42d5ffd7bf1f63f818741d62fe59b0ddd3d9e |
| src/Editor.tsx                              |   5655 | 005af6993f2bbbde7d500ec3a93fec124e789ea7989d936ef6603dddc67f84ca |
| src/main.tsx                                |   1005 | 8b1881675ad8f8e733b50917b80c24f49320f18002eebb402a6d42736bfc4102 |
| src/Markdown.tsx                            |   1793 | 5f1cd35ed3f2619b98d2d36c9c542b7aac2a4007dd2cadea8bdb40bb3c932845 |
| src/storage.ts                              |   2958 | f9e19cb0e34b93955542a95d33eee5d2bd28cd809bc10ee033690a0572ec2e3b |
| src/styles.css                              |  22665 | bc0d32655bc178393dcfdaba97917140477e1be0d82369e35310ac6818b7ea22 |
| src/vite-env.d.ts                           |     38 | 65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5 |
| tests/workspace.spec.ts                     |  28828 | 74631f6cfaeb9ff32c14fb8cb91a7eecf0f54a5654740452a3f5dbafd0d5a17a |
| tsconfig.json                               |    491 | 05c28f8dda05dd4a7b638d419c2da66fc72d5b4d52fb2806f55948f3ff1f8207 |
| vite.config.ts                              |    207 | 55c527ec818735c3dbb9821976625e9ce9b738765c5196261389d19af8175d68 |
