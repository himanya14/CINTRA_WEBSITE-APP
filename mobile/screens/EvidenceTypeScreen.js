import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { calculateSHA256 } from '../services/hashService';
import { uploadEvidence } from '../services/api';
import CasePersonSelector from '../components/CasePersonSelector';

export default function EvidenceTypeScreen({ navigation, route }) {

  const type = route?.params?.type || 'Evidence';

  const [selectedFile, setSelectedFile] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const getIcon = () => {
    switch (type) {
      case 'Image':
        return 'image';
      case 'Video':
        return 'videocam';
      case 'Audio':
        return 'mic';
      case 'Document':
        return 'document-text';
      default:
        return 'folder';
    }
  };

  const getMimeTypeFilter = () => {
    switch (type) {
      case 'Image':
        return 'image/*';
      case 'Video':
        return 'video/*';
      case 'Audio':
        return 'audio/*';
      case 'Document':
        return [
          'application/pdf',
          'application/msword',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
      default:
        return '*/*';
    }
  };

  const handleSelect = async () => {
    try {
      setUploadResult(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: getMimeTypeFilter(),
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const fileAsset = res.assets[0];

        setSelectedFile(fileAsset);

        setIsHashing(true);

        try {
          const hash = await calculateSHA256(fileAsset.uri);
          setFileHash(hash);
        } catch (hashErr) {
          console.error('SHA-256 hash error:', hashErr);
          setFileHash('Unavailable');
        } finally {
          setIsHashing(false);
        }
      }
    } catch (err) {
      console.error('Document picker error:', err);

      Alert.alert(
        'Selection Error',
        'Could not open file picker on device.'
      );
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert(
        'No File Selected',
        `Please select a ${type.toLowerCase()} file from your device first.`
      );
      return;
    }

    if (!selectedCase?.id) {
      Alert.alert('Select Case', 'Choose the FIR/case this evidence belongs to before uploading.');
      return;
    }

    try {
      setIsUploading(true);

      console.log(
        'Uploading evidence file:',
        selectedFile.name
      );

      const resultData = await uploadEvidence(
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType || 'application/octet-stream',
        type,
        {
          caseId: selectedCase?.id,
          personId: selectedPerson?.id,
          title: `${type} - ${selectedFile.name || 'Field Upload'}`,
          description: `Uploaded from CINTRA mobile app and linked to ${selectedCase?.fir_number || selectedCase?.case_id || 'selected case'}.`,
        }
      );

      setUploadResult(resultData);

      Alert.alert(
        'Upload Successful',
        `${type} evidence synchronized with the central CINTRA case.`
      );

    } catch (uploadErr) {
      console.error('Upload failed:', uploadErr);

      Alert.alert(
        'Upload Failed',
        uploadErr.message ||
          'Unable to upload evidence to server.'
      );

    } finally {
      setIsUploading(false);
    }
  };

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
          {type.toUpperCase()} EVIDENCE
        </Text>

        <View style={{ width: 42 }} />

      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Main Icon */}
        <View style={styles.mainIcon}>
          <Ionicons
            name={getIcon()}
            size={45}
            color="#1976D2"
          />
        </View>

        <Text style={styles.title}>
          Upload {type}
        </Text>

        <Text style={styles.description}>
          Select a {type.toLowerCase()} file directly from
          your device storage to calculate SHA-256 hash
          and upload to investigation evidence server.
        </Text>

        <CasePersonSelector
          onCaseChange={setSelectedCase}
          onPersonChange={setSelectedPerson}
        />

        {/* File Selection Card */}
        <View style={styles.card}>

          <View style={styles.fileIcon}>
            <Ionicons
              name={
                selectedFile
                  ? 'document-attach'
                  : getIcon()
              }
              size={32}
              color="#1976D2"
            />
          </View>

          {selectedFile ? (
            <View style={styles.fileInfo}>

              <Text
                style={styles.fileName}
                numberOfLines={1}
              >
                {selectedFile.name}
              </Text>

              <Text style={styles.fileDetails}>
                Size:{' '}
                {selectedFile.size
                  ? (selectedFile.size / 1024).toFixed(1)
                  : '0'}{' '}
                KB | Type:{' '}
                {selectedFile.mimeType || type}
              </Text>

              <View style={styles.hashBox}>

                <Text style={styles.hashLabel}>
                  SHA-256 HASH:
                </Text>

                {isHashing ? (
                  <ActivityIndicator
                    size="small"
                    color="#1976D2"
                  />
                ) : (
                  <Text
                    style={styles.hashValue}
                    numberOfLines={1}
                  >
                    {fileHash}
                  </Text>
                )}

              </View>

            </View>
          ) : (
            <Text style={styles.fileText}>
              No file selected from device
            </Text>
          )}

          <TouchableOpacity
            style={styles.selectButton}
            onPress={handleSelect}
            disabled={isUploading}
          >
            <Ionicons
              name="folder-open"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.buttonText}>
              {selectedFile
                ? 'CHANGE FILE'
                : `SELECT ${type.toUpperCase()}`}
            </Text>
          </TouchableOpacity>

        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            (!selectedFile || isUploading) &&
              styles.disabledButton,
          ]}
          onPress={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator
              color="#FFFFFF"
              size="small"
            />
          ) : (
            <>
              <Ionicons
                name="cloud-upload"
                size={22}
                color="#FFFFFF"
              />

              <Text style={styles.buttonText}>
                UPLOAD TO BACKEND
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Upload Success Card */}
        {uploadResult && (
          <View style={styles.successCard}>

            <View style={styles.successHeader}>

              <Ionicons
                name="checkmark-circle"
                size={24}
                color="#388E3C"
              />

              <Text style={styles.successTitle}>
                SAVED ON SERVER
              </Text>

            </View>

            <Text style={styles.successDetail}>
              Path: {uploadResult.file_path}
            </Text>

            <Text style={styles.successDetail}>
              Size:{' '}
              {(uploadResult.size_bytes / 1024).toFixed(1)}
              {' '}KB
            </Text>

            <Text style={styles.successDetail}>
              SHA-256:{' '}
              {uploadResult.sha256?.substring(0, 16)}...
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
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 15,
    marginBottom: 20,
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
    letterSpacing: 0.8,
  },

  mainIcon: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  title: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },

  description: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 25,
    paddingHorizontal: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 18,
  },

  fileIcon: {
    width: 65,
    height: 65,
    borderRadius: 15,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  fileText: {
    color: '#888',
    fontSize: 13,
    marginBottom: 18,
  },

  fileInfo: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },

  fileName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },

  fileDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },

  hashBox: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },

  hashLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.5,
  },

  hashValue: {
    fontSize: 11,
    fontFamily:
      Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
    marginTop: 2,
  },

  selectButton: {
    height: 50,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  uploadButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
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
    marginTop: 2,
  },

});