import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

// Calculate SHA-256 hash of an evidence file
export const calculateSHA256 = async (fileUri) => {
  const file = new File(fileUri);

  if (!file.exists) {
    throw new Error('Evidence file does not exist.');
  }

  const fileBytes = await file.bytes();

  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileBytes
  );

  const hashArray = new Uint8Array(digest);

  return Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

// Verify that the evidence file has not been modified
export const verifySHA256 = async (fileUri, originalHash) => {
  if (!fileUri || !originalHash) {
    throw new Error(
      'Evidence file and original hash are required.'
    );
  }

  // Calculate the hash again from the actual evidence file
  const recalculatedHash = await calculateSHA256(fileUri);

  const normalizedOriginalHash =
    originalHash.trim().toLowerCase();

  const normalizedRecalculatedHash =
    recalculatedHash.trim().toLowerCase();

  return {
    verified:
      normalizedOriginalHash === normalizedRecalculatedHash,

    originalHash: normalizedOriginalHash,

    recalculatedHash: normalizedRecalculatedHash,
  };
};