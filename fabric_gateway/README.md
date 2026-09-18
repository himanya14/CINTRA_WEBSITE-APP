# CINTRA Hyperledger Fabric Gateway

This is the optional real blockchain bridge used by the FastAPI evidence/custody pipeline.
It is intentionally **not faked**. If no Fabric network is running, keep `FABRIC_ENABLED=false`
in `backend/.env`; CINTRA will show blockchain status `DISABLED` while SHA-256, AES-256-GCM,
PostgreSQL, timeline and chain-of-custody still work normally.

Expected defaults:
- Channel: `cintrachannel`
- Chaincode: `cintra-custody`
- Gateway service: `http://127.0.0.1:4100`

To use a real Fabric network, install/deploy the chaincode under `chaincode/`, then configure:
`FABRIC_MSP_ID`, `FABRIC_PEER_ENDPOINT`, `FABRIC_PEER_HOST_ALIAS`, `FABRIC_TLS_CERT_PATH`,
`FABRIC_CERT_PATH`, and `FABRIC_KEY_PATH` before running `npm install && npm start` here.
Finally set `FABRIC_ENABLED=true` in `backend/.env`.
