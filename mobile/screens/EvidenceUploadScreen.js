import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function EvidenceUploadScreen({ navigation }) {
  const evidenceTypes = [
    { type: 'Image', icon: 'image' },
    { type: 'Video', icon: 'videocam' },
    { type: 'Audio', icon: 'mic' },
    { type: 'Document', icon: 'document-text' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#173F6B" />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>EVIDENCE</Text>
          <Text style={styles.headerSubtitle}>Field collection & secure upload</Text>
        </View>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionEyebrow}>NEW FIELD EVIDENCE</Text>
        <Text style={styles.title}>How are you adding evidence?</Text>
        <Text style={styles.description}>
          Both options use the same case/person mapping, SHA-256 integrity check,
          encrypted backend storage and chain-of-custody flow.
        </Text>

        <TouchableOpacity
          style={styles.captureCard}
          onPress={() => navigation.navigate('CaptureEvidence')}
          activeOpacity={0.82}
        >
          <View style={styles.captureIcon}>
            <Ionicons name="camera" size={30} color="#173F6B" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Capture New Photo</Text>
            <Text style={styles.cardText}>
              Take/select a field photo, map it to an existing FIR and person, then upload.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#173F6B" />
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR UPLOAD EXISTING FILE</Text>
          <View style={styles.divider} />
        </View>

        {evidenceTypes.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={styles.fileCard}
            onPress={() => navigation.navigate('EvidenceType', { type: item.type })}
            activeOpacity={0.82}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={27} color="#173F6B" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.fileTitle}>{item.type}</Text>
              <Text style={styles.fileText}>Choose an existing {item.type.toLowerCase()} file</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6E7E90" />
          </TouchableOpacity>
        ))}

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={21} color="#173F6B" />
          <Text style={styles.securityText}>
            Evidence is attributed to the authenticated officer session, not a typed badge ID.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E9EF',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAF1F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#173F6B',
    letterSpacing: 1.1,
  },
  headerSubtitle: {
    fontSize: 10.5,
    color: '#738297',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#426889',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#172B3F',
    marginTop: 6,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#66778A',
    marginTop: 7,
    marginBottom: 18,
  },
  captureCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C9D8E6',
  },
  captureIcon: {
    width: 54,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#EAF1F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#173F6B',
  },
  cardText: {
    marginTop: 4,
    fontSize: 11.5,
    color: '#66778A',
    lineHeight: 17,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#D8E0E8',
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8190A0',
    letterSpacing: 0.7,
  },
  fileCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#E3E9EF',
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 11,
    backgroundColor: '#EDF3F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  fileTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#23394F',
  },
  fileText: {
    marginTop: 3,
    fontSize: 11,
    color: '#748396',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAF1F8',
    borderRadius: 12,
    padding: 13,
    marginTop: 8,
  },
  securityText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#50677E',
  },
});
