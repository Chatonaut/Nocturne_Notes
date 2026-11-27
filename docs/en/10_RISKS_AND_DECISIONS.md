# Risks and decisions — 2.5.0
| Topic | Decision / limitation |
|---|---|
| UI | Frozen native shell; GPU, DPI and Windows compositor variation need real hardware checks. |
| Storage | SQLite exclusive lock while open, transactions and recovery; close before copying/moving; back up .ns. Do not edit same project simultaneously. |
| Recovery | Exact file identity; canonical-path fallback for known single-link inode-zero file cannot follow arbitrary rename. External deletion/replacement may orphan sidecars. No sharing across editions. Real FAT/exFAT and physical power loss not fully tested. |
| Protection | Optional SQLCipher; minimum 8 Unicode code points, use a long unique password. No reset. Names, clipboard, plaintext export, previous copies, snapshots and OS paging are outside protection. No secure erasure. |
| Lock | Explicit, no auto-lock on tray/minimize. Flush failure remains masked until retry/cancel. |
| Profiles | Independent stable profiles; no automatic migration or erasure of existing profiles. |
| Signing | Unsigned EXEs may show Windows SmartScreen; SHA-256 verifies integrity, not publisher identity. |
| Spellcheck | Optional dictionaries may fetch; OS paths are outside default network interception. No account/sync/telemetry feature. |
| History/export | Undo 50 steps per note, shared approximate 64 MiB, session-only. Markdown basic, not lossless. |
| Security scope | Pinned advisory checks, sandbox, CSP, validated IPC, ASAR/fuses; not certification or proof of no vulnerabilities. CLI-only CVE disposition conditional. Four deprecated build-only transitives retained pending safe upgrades. |
| Performance | Synthetic CI timings vary; summed working sets can double-count pages; 60 short workload sessions do not prove absence of long-run leaks. Portable extraction contributes to end-to-end startup. |
| Release | Independent build bytes can differ; verify actual corresponding checksums and source provenance. |
| Scope | No older-version migration/compatibility work. No new feature or code change without explicit approval. |

Do not weaken gates, alter frozen behavior, erase user data or claim unsupported guarantees.
