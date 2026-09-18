import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  verifySHA256,
} from '../services/hashService';

import {
  logout,
  getCurrentUser,
  updateActivity,
} from '../services/authService';

import ForensicWatermark from '../components/ForensicWatermark';

export default function ResultScreen({ navigation, route }) {
  const [verifying, setVerifying] = useState(false);

  const evidence = route?.params?.evidence;

  // Result is authoritative only when returned by the central CINTRA backend.
  const response = route?.params?.response || {
    match: false,
    suspect: null,
    message: 'No identification result returned.',
  };

  const capturedImage =
    route?.params?.capturedImage ||
    evidence?.uri ||
    null;

  const isMatch = response?.match === true;

  const currentUser = getCurrentUser();

  // --------------------
  // SHA-256 verification
  // --------------------

  const handleVerifyIntegrity = async () => {
    updateActivity();

    if (!evidence?.uri || !evidence?.sha256) {
      Alert.alert(
        'Verification Failed',
        'Evidence data or SHA-256 hash is missing.'
      );
      return;
    }

    try {
      setVerifying(true);

      const result = await verifySHA256(
        evidence.uri,
        evidence.sha256
      );

      if (result.verified) {
        Alert.alert(
          'Integrity Verified',
          'The evidence file has not been modified.'
        );
      } else {
        Alert.alert(
          'Integrity Warning',
          'The evidence file may have been modified.'
        );
      }
    } catch (error) {
      console.error(
        'Integrity verification error:',
        error
      );

      Alert.alert(
        'Verification Failed',
        'Unable to verify the evidence integrity.'
      );
    } finally {
      setVerifying(false);
    }
  };

  // --------------------
  // Scan again
  // --------------------

  const handleScanAgain = () => {
    updateActivity();
    navigation.navigate('Scanner');
  };

  // --------------------
  // Logout
  // --------------------

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  // --------------------
  // No evidence case
  // --------------------

  if (!evidence && !capturedImage) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle"
          size={55}
          color="#1976D2"
        />

        <Text style={styles.errorText}>
          No evidence or captured image available.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.replace('Scanner')}
        >
          <Ionicons
            name="camera"
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.buttonText}>
            RETURN TO SCANNER
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
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

        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            EVIDENCE RESULT
          </Text>

          <Text style={styles.subtitle}>
            Identification & Integrity
          </Text>
        </View>

        <View style={{ width: 42 }} />
      </View>

      {/* Captured Image */}

      <View style={styles.imageContainer}>
        <Image
          source={{ uri: capturedImage }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Detection box */}

        <View
          style={[
            styles.detectionBox,
            isMatch
              ? styles.matchBox
              : styles.noMatchBox,
          ]}
        >
          <View
            style={[
              styles.boxBadge,
              isMatch ? styles.matchBadge : styles.noMatchBadge,
            ]}
          >
            <Text style={styles.boxBadgeText}>
              {isMatch ? '✓ MATCH FOUND' : '⚠ NO MATCH'}
            </Text>
          </View>
        </View>

        {/* Forensic watermark */}

        {evidence && (
          <ForensicWatermark
            badgeId={
              evidence.badgeId ||
              currentUser?.badgeId
            }
            capturedAt={evidence.capturedAt}
          />
        )}
      </View>

      {/* Match Result */}

      <View
        style={[
          styles.resultCard,
          isMatch
            ? styles.matchCard
            : styles.noMatchCard,
        ]}
      >
        <View style={styles.resultIcon}>
          <Ionicons
            name={
              isMatch
                ? 'checkmark-circle'
                : 'alert-circle'
            }
            size={42}
            color="#1976D2"
          />
        </View>

        <Text style={styles.resultTitle}>
          {isMatch
            ? 'MATCH FOUND'
            : 'NO MATCH FOUND'}
        </Text>

        <Text style={styles.resultMessage}>
          {response?.message ||
            'Identification result received.'}
        </Text>
      </View>

      {/* Suspect Information */}

      {isMatch && response?.suspect && (
        <View style={styles.suspectCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="person"
              size={22}
              color="#1976D2"
            />
            <Text style={styles.sectionTitle}>
              SUSPECT INFORMATION
            </Text>
          </View>


          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Suspect ID
            </Text>

            <Text style={styles.value}>
              {response.suspect.suspect_id ||
                response.suspect.id ||
                'N/A'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Name
            </Text>

            <Text style={styles.value}>
              {response.suspect.name}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Role / Charges
            </Text>

            <Text style={styles.value}>
              {response.suspect.role || 'N/A'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Confidence
            </Text>

            <Text style={styles.value}>
              {response.suspect.confidence !==
              undefined
                ? `${response.suspect.confidence}%`
                : 'N/A'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Status
            </Text>

            <Text
              style={[
                styles.value,
                response.suspect.wanted
                  ? styles.wantedText
                  : styles.notWantedText,
              ]}
            >
              {response.suspect.wanted
                ? 'WANTED'
                : 'NOT WANTED'}
            </Text>
          </View>

          {response.suspect.alias && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Alias</Text>
                <Text style={styles.value}>{response.suspect.alias}</Text>
              </View>
            </>
          )}

          {response.suspect.fir_number && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>FIR Number</Text>
                <Text style={styles.value}>{response.suspect.fir_number}</Text>
              </View>
            </>
          )}

          {response.suspect.offence_category && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Offence Category</Text>
                <Text style={styles.value}>{response.suspect.offence_category}</Text>
              </View>
            </>
          )}

          {response.suspect.applicable_section && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Sections</Text>
                <Text style={styles.value}>{response.suspect.applicable_section}</Text>
              </View>
            </>
          )}

          {response.suspect.severity && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Severity</Text>
                <Text style={[styles.value, { color: '#D32F2F', fontWeight: 'bold' }]}>{response.suspect.severity}</Text>
              </View>
            </>
          )}

          {response.suspect.case_status && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Case Status</Text>
                <Text style={styles.value}>{response.suspect.case_status}</Text>
              </View>
            </>
          )}

          {response.suspect.police_station && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Police Station</Text>
                <Text style={styles.value}>{response.suspect.police_station}</Text>
              </View>
            </>
          )}

          {response.suspect.penalty && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Penalty / Fine</Text>
                <Text style={styles.value}>{response.suspect.penalty}</Text>
              </View>
            </>
          )}

          {response.suspect.offence_description && (
            <>
              <View style={styles.divider} />
              <View style={{ paddingTop: 10 }}>
                <Text style={styles.label}>Offence Description</Text>
                <Text style={{ fontSize: 13, color: '#333', marginTop: 4, lineHeight: 18 }}>
                  {response.suspect.offence_description}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* SHA-256 Evidence Information */}

      {evidence && (
        <View style={styles.integrityCard}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name="shield-checkmark"
              size={22}
              color="#1976D2"
            />

            <Text style={styles.sectionTitle}>
              EVIDENCE INTEGRITY
            </Text>
          </View>

          <Text style={styles.label}>
            Officer ID
          </Text>

          <Text style={styles.valueLeft}>
            {evidence.badgeId ||
              currentUser?.badgeId ||
              'Unknown'}
          </Text>

          <Text style={styles.label}>
            Captured At
          </Text>

          <Text style={styles.valueLeft}>
            {evidence.capturedAt
              ? new Date(
                  evidence.capturedAt
                ).toLocaleString()
              : 'Unknown'}
          </Text>

          <Text style={styles.label}>
            SHA-256 Hash
          </Text>

          <Text
            style={styles.hash}
            selectable
          >
            {evidence.sha256 ||
              'Hash unavailable'}
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              verifying &&
                styles.disabledButton,
            ]}
            onPress={handleVerifyIntegrity}
            disabled={verifying}
          >
            <Ionicons
              name="shield-checkmark"
              size={21}
              color="#FFFFFF"
            />

            <Text style={styles.buttonText}>
              {verifying
                ? 'VERIFYING...'
                : 'VERIFY INTEGRITY'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scan Again */}

      <TouchableOpacity
        style={styles.button}
        onPress={handleScanAgain}
        activeOpacity={0.8}
      >
        <Ionicons
          name="camera"
          size={21}
          color="#FFFFFF"
        />

        <Text style={styles.buttonText}>
          CAPTURE NEW EVIDENCE
        </Text>
      </TouchableOpacity>

      {/* Logout */}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons
          name="log-out"
          size={21}
          color="#1976D2"
        />

        <Text style={styles.logoutText}>
          LOGOUT
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 25,
    backgroundColor: '#F5F7FA',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#F5F7FA',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  headerTextContainer: {
    alignItems: 'center',
  },

  title: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1,
  },

  subtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 3,
  },

  imageContainer: {
    width: '100%',
    height: 350,
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 18,
  },

  image: {
    width: '100%',
    height: '100%',
  },

  detectionBox: {
    position: 'absolute',
    width: 220,
    height: 280,
    top: 35,
    left: '50%',
    marginLeft: -110,
    borderWidth: 3,
    borderRadius: 12,
    alignItems: 'center',
  },

  matchBox: {
    borderColor: '#00c853',
    backgroundColor: 'rgba(0, 200, 83, 0.18)',
  },

  noMatchBox: {
    borderColor: '#ffd600',
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
  },

  boxBadge: {
    position: 'absolute',
    top: -16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
  },

  matchBadge: {
    backgroundColor: '#00c853',
  },

  noMatchBadge: {
    backgroundColor: '#ffd600',
  },

  boxBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  resultCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 18,
  },

  matchCard: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
  },

  noMatchCard: {
    backgroundColor: '#F5F7FA',
    borderColor: '#90A4AE',
  },

  resultIcon: {
    marginBottom: 8,
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1976D2',
  },

  resultMessage: {
    marginTop: 7,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },

  suspectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    marginBottom: 18,
  },

  integrityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    marginBottom: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },

  label: {
    fontSize: 13,
    color: '#666',
    marginTop: 9,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    maxWidth: '60%',
    textAlign: 'right',
  },

  valueLeft: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },

  wantedText: {
    color: '#1976D2',
    fontWeight: 'bold',
  },

  notWantedText: {
    color: '#388E3C',
    fontWeight: 'bold',
  },

  hash: {
    fontSize: 11,
    color: '#333',
    marginTop: 5,
    lineHeight: 17,
  },

  button: {
    width: '100%',
    minHeight: 50,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  logoutButton: {
    width: '100%',
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 20,
  },

  logoutText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 7,
  },

  errorText: {
    fontSize: 16,
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
    color: '#555',
  },
});