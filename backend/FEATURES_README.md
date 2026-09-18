# CINTRA expanded website modules

This update extends the existing CINTRA project without replacing the current UI system.

## Added backend modules
- `/legal` — BNS, legacy IPC and special-law reference data + case provisions.
- `/master-data` — controlled reference data.
- `/cross-case` — normalized entity identifiers, historical appearances and cross-case networks.
- `/timeline` — merged case/evidence/diary/intelligence/forensic timeline.
- `/custody` — chain-of-custody events for evidence.
- `/case-intelligence` — explainable case leads, alerts and review.
- relationship provenance/review endpoints under `/relationships/{id}/...`.
- `/features` — 374-capability coverage registry.

## Added frontend modules
- Forensic Overview based on real assignment + case-level evidence counts.
- Forensic Case Intelligence (replaces government statistics for the FA route only).
- Cross-Case Intelligence.
- Legal Codes & Offences master.
- Case Legal Provisions.
- Master Data.
- Full Investigation Timeline.
- Relationship edge explainability UI.

The original Login, Digital Forensics, Hash & Integrity, CDR Analysis, Media Analysis and CINTRA visual identity are preserved.
