const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');

const PORT = Number(process.env.PORT || 4100);
const CHANNEL = process.env.FABRIC_CHANNEL || 'cintrachannel';
const CHAINCODE = process.env.FABRIC_CHAINCODE || 'cintra-custody';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function newGrpcConnection() {
  const tlsRootCert = fs.readFileSync(required('FABRIC_TLS_CERT_PATH'));
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(required('FABRIC_PEER_ENDPOINT'), tlsCredentials, {
    'grpc.ssl_target_name_override': required('FABRIC_PEER_HOST_ALIAS'),
  });
}

function newIdentity() {
  return {
    mspId: required('FABRIC_MSP_ID'),
    credentials: fs.readFileSync(required('FABRIC_CERT_PATH')),
  };
}

function newSigner() {
  const privateKeyPem = fs.readFileSync(required('FABRIC_KEY_PATH'));
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function submitCustody(payload) {
  const client = newGrpcConnection();
  const gateway = connect({
    client,
    identity: newIdentity(),
    signer: newSigner(),
    hash: hash.sha256,
  });

  try {
    const network = gateway.getNetwork(CHANNEL);
    const contract = network.getContract(CHAINCODE);
    const proposal = contract.newProposal('RecordCustodyEvent', {
      arguments: [JSON.stringify(payload)],
    });
    const endorsed = await proposal.endorse();
    const submitted = await endorsed.submit();
    const status = await submitted.getStatus();
    if (!status.successful) {
      throw new Error(`Fabric commit failed with code ${status.code}`);
    }
    return status.transactionId;
  } finally {
    gateway.close();
    client.close();
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    channel: CHANNEL,
    chaincode: CHAINCODE,
    configured: Boolean(process.env.FABRIC_PEER_ENDPOINT),
  });
});

app.post('/api/fabric/custody', async (req, res) => {
  try {
    const transactionId = await submitCustody(req.body || {});
    res.json({ success: true, transaction_id: transactionId });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`CINTRA Fabric Gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`Channel: ${CHANNEL} | Chaincode: ${CHAINCODE}`);
});
