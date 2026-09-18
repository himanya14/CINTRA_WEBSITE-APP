import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { calculateSHA256 } from '../services/hashService';
import { uploadEvidence, identifyFace } from '../services/api';
import CasePersonSelector from '../components/CasePersonSelector';
import { getCurrentUser } from '../services/authService';
import ForensicWatermark from '../components/ForensicWatermark';

export default function CaptureEvidenceScreen({ navigation }) {
  const [capturedImage, setCapturedImage] = useState(null);
  const [imageName, setImageName] = useState('evidence_photo.jpg');
  const [imageHash, setImageHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const handleCapturePhoto = async () => {
    try {
      setUploadResult(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setCapturedImage(asset.uri);
        setImageName(asset.name || 'evidence_photo.jpg');
        setIsHashing(true);

        try {
          const hash = await calculateSHA256(asset.uri);
          setImageHash(hash);
        } catch (hashErr) {
          console.error('SHA-256 hash error:', hashErr);
          setImageHash('Hash calculation failed');
        } finally {
          setIsHashing(false);
        }
      }
    } catch (err) {
      console.error('Image capture/picker error:', err);
      Alert.alert(
        'Capture Error',
        'Could not capture or pick image from device.'
      );
    }
  };

  const handleUploadEvidence = async () => {
    if (!capturedImage) {
      Alert.alert('No Image', 'Please capture or select a photo first.');
      return;
    }

    if (!selectedCase?.id) {
      Alert.alert('Select Case', 'Choose the FIR/case this evidence belongs to before uploading.');
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadEvidence(
        capturedImage,
        imageName,
        'image/jpeg',
        'Photo Evidence',
        {
          caseId: selectedCase?.id,
          personId: selectedPerson?.id,
          title: `Field Photo - ${imageName}`,
          description: `Captured/selected in CINTRA mobile field app for ${selectedCase?.fir_number || selectedCase?.case_id || 'selected case'}.`,
        }
      );

      setUploadResult(result);
      Alert.alert(
        'Evidence Uploaded',
        'Photo evidence has been synchronized with the central CINTRA investigation.'
      );
    } catch (uploadErr) {
      console.error('Upload evidence error:', uploadErr);
      Alert.alert(
        'Upload Failed',
        uploadErr.message || 'Unable to upload evidence to backend server.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleMatchWithDatabase = async () => {
    if (!capturedImage) {
      Alert.alert('No Image', 'Please capture a photo before matching with database.');
      return;
    }

    try {
      setIsMatching(true);
      const res = await identifyFace(capturedImage);
      navigation.navigate('FaceMatchResult', { response: res });
    } catch (err) {
      console.warn('Face match error:', err);
      Alert.alert('Face Match Failed', err?.message || 'Unable to query the central CINTRA person database.');
    } finally {
      setIsMatching(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setImageHash('');
    setUploadResult(null);
  };

  const user = getCurrentUser();
  const badgeId = user?.officer_id || user?.badgeId || '—';

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#1976D2"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          CAPTURE EVIDENCE
        </Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Description */}
        <Text style={styles.instruction}>
          Capture photographic evidence for investigation, verify its SHA-256 hash, and upload directly to backend storage.
        </Text>

        <CasePersonSelector
          compact
          onCaseChange={setSelectedCase}
          onPersonChange={setSelectedPerson}
        />

        {/* Preview / Camera Area */}
        <View style={styles.cameraBox}>
          {capturedImage ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: capturedImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />

              <ForensicWatermark
                badgeId={badgeId}
                capturedAt={new Date().toISOString()}
              />
            </View>
          ) : (
            <>
              <View style={styles.cameraIconContainer}>
                <Ionicons
                  name="camera"
                  size={48}
                  color="#1976D2"
                />
              </View>

              <Text style={styles.cameraTitle}>
                PHOTO PREVIEW
              </Text>

              <Text style={styles.cameraSubtitle}>
                Tap below to capture or select evidence photo
              </Text>
            </>
          )}
        </View>

        {/* SHA-256 Hash Card if photo present */}
        {capturedImage && (
          <View style={styles.hashCard}>
            <View style={styles.hashHeader}>
              <Ionicons name="shield-checkmark" size={18} color="#1976D2" />
              <Text style={styles.hashTitle}>SHA-256 EVIDENCE INTEGRITY HASH</Text>
            </View>

            {isHashing ? (
              <ActivityIndicator size="small" color="#1976D2" style={{ marginVertical: 6 }} />
            ) : (
              <Text style={styles.hashText} selectable>
                {imageHash || 'Calculating...'}
              </Text>
            )}
          </View>
        )}

        {/* Buttons */}
        {capturedImage ? (
          <View style={styles.actionColumn}>
            {/* Upload Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isUploading && styles.disabledButton]}
              onPress={handleUploadEvidence}
              disabled={isUploading || isMatching}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={22} color="#FFFFFF" />
                  <Text style={styles.buttonText}>UPLOAD EVIDENCE TO BACKEND</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Match Button */}
            <TouchableOpacity
              style={[styles.matchButton, isMatching && styles.disabledButton]}
              onPress={handleMatchWithDatabase}
              disabled={isUploading || isMatching}
            >
              {isMatching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="scan" size={22} color="#FFFFFF" />
                  <Text style={styles.buttonText}>MATCH WITH DATABASE</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Retake Button */}
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
              disabled={isUploading || isMatching}
            >
              <Ionicons name="refresh" size={20} color="#1976D2" />
              <Text style={styles.retakeText}>RETAKE / CAPTURE ANOTHER</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCapturePhoto}
          >
            <Ionicons name="camera" size={22} color="#FFFFFF" />
            <Text style={styles.buttonText}>TAKE / SELECT EVIDENCE PHOTO</Text>
          </TouchableOpacity>
        )}

        {/* Upload Success Card */}
        {uploadResult && (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#388E3C" />
              <Text style={styles.successTitle}>EVIDENCE SAVED TO BACKEND</Text>
            </View>

            <Text style={styles.successDetail}>
              Server Path: {uploadResult.file_path}
            </Text>
            <Text style={styles.successDetail}>
              Evidence Type: {uploadResult.type}
            </Text>
            <Text style={styles.successDetail}>
              Officer ID: {uploadResult.officer_id}
            </Text>
            <Text style={styles.successDetail}>
              File Size: {(uploadResult.size_bytes / 1024).toFixed(1)} KB
            </Text>
            <Text style={styles.successDetail}>
              SHA-256: {uploadResult.sha256}
            </Text>
            <Text style={styles.successDetail}>
              Integrity: {uploadResult.integrity_status || '—'}
            </Text>
            <Text style={styles.successDetail}>
              Encryption: {uploadResult.encryption || '—'}
            </Text>
            <Text style={styles.successDetail}>
              Fabric: {uploadResult.blockchain_status || '—'}
            </Text>
            <Text style={styles.successDetail}>
              Case: {uploadResult.fir_number || uploadResult.case_id}
            </Text>
            {uploadResult.person_name ? (
              <Text style={styles.successDetail}>
                Linked Person: {uploadResult.person_name}
              </Text>
            ) : null}
            <Text style={styles.successDetail}>
              Synced: {(uploadResult.synced_to || []).join(' • ')}
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 35,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 15,
    marginBottom: 15,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1,
  },

  instruction: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 18,
    paddingHorizontal: 10,
  },

  cameraBox: {
    height: 310,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    marginBottom: 16,
    overflow: 'hidden',
  },

  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  cameraIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  cameraTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },

  cameraSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },

  hashCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
  },

  hashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  hashTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  hashText: {
    fontSize: 11,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 16,
  },

  actionColumn: {
    gap: 12,
  },

  primaryButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  matchButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  retakeButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 9,
    letterSpacing: 0.4,
  },

  retakeText: {
    color: '#1976D2',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 7,
  },

  successCard: {
    marginTop: 18,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },

  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  successTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginLeft: 8,
  },

  successDetail: {
    fontSize: 12,
    color: '#333',
    marginTop: 3,
  },
});