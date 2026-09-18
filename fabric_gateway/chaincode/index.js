'use strict';
const { Contract } = require('fabric-contract-api');

class CintraCustodyContract extends Contract {
  async RecordCustodyEvent(ctx, eventJson) {
    const event = JSON.parse(eventJson);
    if (!event.evidence_id || !event.event_id || !event.action || !event.file_sha256) {
      throw new Error('evidence_id, event_id, action and file_sha256 are required');
    }

    const key = ctx.stub.createCompositeKey('CUSTODY', [
      String(event.evidence_id),
      String(event.event_id),
    ]);
    const exists = await ctx.stub.getState(key);
    if (exists && exists.length) {
      throw new Error(`Custody event ${event.event_id} already exists`);
    }

    const record = { ...event };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
    return JSON.stringify(record);
  }

  async GetEvidenceCustody(ctx, evidenceId) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey('CUSTODY', [String(evidenceId)]);
    const rows = [];
    try {
      while (true) {
        const result = await iterator.next();
        if (result.value && result.value.value) {
          rows.push(JSON.parse(result.value.value.toString('utf8')));
        }
        if (result.done) break;
      }
    } finally {
      await iterator.close();
    }
    return JSON.stringify(rows);
  }
}

module.exports.contracts = [CintraCustodyContract];
