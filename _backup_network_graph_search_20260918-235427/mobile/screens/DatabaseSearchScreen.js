import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchSuspect } from '../services/api';

export default function DatabaseSearchScreen({ navigation }) {

  const [criminalId, setCriminalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async (idToSearch = criminalId) => {
    const id = idToSearch.trim();

    if (!id) {
      Alert.alert(
        'Missing ID',
        'Enter a Person ID from the central CINTRA database.'
      );
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const data = await searchSuspect(id);
      setResult(data);

    } catch (error) {
      console.log('[CINTRA Search] Suspect search result:', error.message);
      Alert.alert(
        'Search Result',
        error.message || 'Suspect not found in database.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (iconName, title) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={iconName} size={20} color="#1976D2" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderDetailRow = (label, value, isHighlight = false) => {
    if (!value) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, isHighlight && styles.highlightText]}>
          {value}
        </Text>
      </View>
    );
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
          CRIMINAL DATABASE
        </Text>

        <View style={{ width: 42 }} />

      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >

        {/* Main Icon */}
        <View style={styles.mainIcon}>
          <Ionicons
            name="search"
            size={42}
            color="#1976D2"
          />
        </View>

        <Text style={styles.title}>
          Search Criminal Records
        </Text>

        <Text style={styles.description}>
          Enter a Person ID or exact person name from the shared CINTRA database.
        </Text>

        {/* Search Card */}
        <View style={styles.card}>

          <Text style={styles.label}>
            CRIMINAL / SUSPECT ID OR NAME
          </Text>

          <View style={styles.inputContainer}>

            <Ionicons
              name="card"
              size={20}
              color="#1976D2"
            />

            <TextInput
              style={styles.input}
              placeholder="Enter central Person ID or exact name"
              placeholderTextColor="#999"
              value={criminalId}
              onChangeText={setCriminalId}
              autoCapitalize="none"
              editable={!loading}
            />

          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              loading && styles.disabledButton
            ]}
            onPress={() => handleSearch()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />
            ) : (
              <>
                <Ionicons
                  name="search"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.buttonText}>
                  SEARCH DATABASE
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>

        {/* Detailed Suspect Record Result */}
        {result && (
          <View style={styles.resultContainer}>

            {/* Suspect Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name="person-circle"
                  size={50}
                  color="#1976D2"
                />
                <View style={styles.resultHeaderText}>
                  <Text style={styles.suspectName}>
                    {result.name}
                  </Text>
                  <Text style={styles.suspectCode}>
                    ID: {result.suspect_id} {result.alias ? `| Alias: "${result.alias}"` : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    result.wanted ? styles.wantedBadge : styles.safeBadge,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {result.wanted ? 'WANTED' : 'CLEARED'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 1. Person Identification */}
            <View style={styles.detailCard}>
              {renderSectionHeader('person', '1. PERSON IDENTIFICATION')}
              {renderDetailRow('Full Name', result.name)}
              {renderDetailRow('Alias / Known As', result.alias)}
              {renderDetailRow('Date of Birth', result.dob)}
              {renderDetailRow('Gender', result.gender)}
              {renderDetailRow('Nationality', result.nationality)}
              {renderDetailRow('Unique Case/Person ID', result.suspect_id, true)}
            </View>

            {/* 2. Case Information */}
            <View style={styles.detailCard}>
              {renderSectionHeader('briefcase', '2. CASE INFORMATION')}
              {renderDetailRow('Case / FIR Number', result.fir_number, true)}
              {renderDetailRow('Offence Category', result.offence_category)}
              {renderDetailRow('Date of Incident', result.incident_date)}
              {renderDetailRow('Location of Incident', result.incident_location)}
              {renderDetailRow('Police Station / Agency', result.police_station)}
              {renderDetailRow('Court Name', result.court_name)}
              {renderDetailRow('Court Case Number', result.court_case_number)}
              {renderDetailRow('Filing Date', result.filing_date)}
            </View>

            {/* 3. Offence Information */}
            <View style={styles.detailCard}>
              {renderSectionHeader('alert-circle', '3. OFFENCE INFORMATION')}
              {renderDetailRow('Offence Category', result.offence_category)}
              {renderDetailRow('Applicable Law / Section', result.applicable_section, true)}
              {renderDetailRow('Threat / Severity Level', result.severity)}
              {result.offence_description && (
                <View style={styles.descriptionBlock}>
                  <Text style={styles.descriptionLabel}>Offence Description:</Text>
                  <Text style={styles.descriptionText}>{result.offence_description}</Text>
                </View>
              )}
            </View>

            {/* 4. Case Status & Outcome */}
            <View style={styles.detailCard}>
              {renderSectionHeader('ribbon', '4. CASE STATUS & LEGAL OUTCOME')}
              {renderDetailRow('Case Status', result.case_status, true)}
              {renderDetailRow('Judgment Date', result.judgment_date)}
              {renderDetailRow('Verdict', result.verdict)}
              {renderDetailRow('Sentence Type', result.sentence_type)}
              {renderDetailRow('Sentence Duration', result.sentence_duration)}
              {renderDetailRow('Fine / Penalty', result.penalty)}
              {renderDetailRow('Appeal Status', result.appeal_status)}
            </View>

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
    fontSize: 19,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.8,
  },

  mainIcon: {
    width: 85,
    height: 85,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#222',
  },

  description: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 25,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    marginBottom: 20,
  },

  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 9,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
  },

  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },

  demoLabel: {
    fontSize: 12,
    color: '#888',
  },

  demoChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },

  demoChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
  },

  searchButton: {
    height: 52,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 9,
  },

  resultContainer: {
    gap: 16,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#1976D2',
  },

  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  resultHeaderText: {
    marginLeft: 12,
    flex: 1,
  },

  suspectName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#222',
  },

  suspectCode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  wantedBadge: {
    backgroundColor: '#FFEBEE',
  },

  safeBadge: {
    backgroundColor: '#E8F5E9',
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#D32F2F',
  },

  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    elevation: 3,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
    marginLeft: 8,
    letterSpacing: 0.5,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
  },

  detailLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },

  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    flex: 1.3,
    textAlign: 'right',
  },

  highlightText: {
    color: '#1976D2',
    fontWeight: 'bold',
  },

  descriptionBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
  },

  descriptionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },

  descriptionText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },

});
