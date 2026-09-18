# CINTRA final demo check

1. Backend health says `postgresql` + `cintra_db`.
2. Website: `SH-001` + website password -> Authenticator code -> login.
3. Mobile: same `SH-001` + same password -> same Authenticator/TOTP system -> login.
4. Mobile case selector shows the same FIRs/cases visible on the website.
5. Selecting a case loads persons already mapped to that same case.
6. Upload one image/document from mobile and link it to a case + person.
7. Upload response shows SHA-256, `AES-256-GCM`, integrity `VERIFIED`, case/FIR and officer.
8. Website Evidence page shows the new record.
9. Person Documents & Records shows it when linked to a person.
10. Relationship Analysis shows Person -> Evidence.
11. Timeline shows `EVIDENCE_CAPTURED`.
12. Chain of Custody shows `REGISTERED` by `SH-001`.
13. Restart app/web: data remains because it lives in PostgreSQL.
14. Fabric status is `RECORDED` only when a real gateway/network returned a transaction ID; otherwise `DISABLED`/`FAILED`.
