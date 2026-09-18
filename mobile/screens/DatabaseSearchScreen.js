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

function valueOrDash(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  return String(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export default function DatabaseSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    const clean = query.trim();
    if (!clean) {
      Alert.alert('Search Required', 'Enter an exact Person ID or person name.');
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      setResult(await searchSuspect(clean));
    } catch (error) {
      Alert.alert('Search Result', error?.message || 'Person not found.');
    } finally {
      setLoading(false);
    }
  };

  const cases = Array.isArray(result?.cases) ? result.cases : [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={23} color="#173F6B" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>DATABASE SEARCH</Text>
          <Text style={styles.headerSubtitle}>Central CINTRA person & case records</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.searchCard}>
          <Text style={styles.label}>PERSON ID OR EXACT NAME</Text>
          <View style={styles.inputRow}>
            <Ionicons name="search" size={20} color="#426889" />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. P-DEMO-001 or Ravi Mehra"
              placeholderTextColor="#8A98A8"
              autoCorrect={false}
              editable={!loading}
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity
            style={[styles.searchButton, loading && styles.disabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="search" size={19} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>SEARCH CENTRAL DATABASE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {result && (
          <>
            <View style={styles.personCard}>
              <View style={styles.personIcon}>
                <Ionicons name="person" size={28} color="#173F6B" />
              </View>
              <View style={styles.personCopy}>
                <Text style={styles.personName}>{result.name}</Text>
                <Text style={styles.personId}>{result.suspect_id}</Text>
                <Text style={styles.personMeta}>
                  {valueOrDash(result.role)} · {valueOrDash(result.status)}
                </Text>
              </View>
              <View style={styles.caseCountBadge}>
                <Text style={styles.caseCount}>{cases.length}</Text>
                <Text style={styles.caseCountLabel}>CASES</Text>
              </View>
            </View>

            <View style={styles.personDetails}>
              <Detail label="Age" value={result.age} />
              <Detail label="Gender" value={result.gender} />
              <Detail label="Phone" value={result.phone} />
              <Detail label="Address" value={result.address} />
            </View>

            <Text style={styles.sectionEyebrow}>ASSOCIATED CASES</Text>
            <Text style={styles.sectionTitle}>Investigation history</Text>

            {cases.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={27} color="#718196" />
                <Text style={styles.emptyTitle}>No linked cases</Text>
                <Text style={styles.emptyText}>
                  This person exists in the central database but has no CasePerson mapping.
                </Text>
              </View>
            ) : (
              cases.map((item, index) => {
                const legalSections = Array.isArray(item.legal_sections) ? item.legal_sections : [];
                return (
                  <View style={styles.caseCard} key={`${item.id || item.case_id}-${index}`}>
                    <View style={styles.caseHeader}>
                      <View style={styles.caseHeaderCopy}>
                        <Text style={styles.fir}>{valueOrDash(item.fir_number)}</Text>
                        <Text style={styles.caseTitle}>{valueOrDash(item.title)}</Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>{valueOrDash(item.status)}</Text>
                      </View>
                    </View>

                    <View style={styles.block}>
                      <BlockTitle icon="briefcase-outline" title="CASE INFORMATION" />
                      <Detail label="CINTRA Case ID" value={item.case_id} />
                      <Detail label="Role in Case" value={item.role_in_case} emphasis />
                      <Detail label="Investigation Stage" value={item.stage} />
                      <Detail label="Police Station" value={item.police_station} />
                      <Detail label="Investigating Officer" value={item.investigating_officer} />
                      <Detail label="Registered On" value={formatDate(item.registered_on)} />
                    </View>

                    <View style={styles.block}>
                      <BlockTitle icon="alert-circle-outline" title="OFFENCE INFORMATION" />
                      <Detail label="Offence" value={item.offence} emphasis />
                      {item.offence_description ? (
                        <Text style={styles.longText}>{item.offence_description}</Text>
                      ) : null}
                    </View>

                    <View style={styles.block}>
                      <BlockTitle icon="document-text-outline" title="LEGAL RECORD" />
                      {legalSections.length ? (
                        legalSections.map((section, sectionIndex) => (
                          <View style={styles.legalItem} key={`${section.section_number}-${sectionIndex}`}>
                            <Text style={styles.legalSection}>
                              {valueOrDash(section.framework)} § {valueOrDash(section.section_number)}
                            </Text>
                            <Text style={styles.legalName}>{valueOrDash(section.offence_name)}</Text>
                            <Text style={styles.legalMeta}>Status: {valueOrDash(section.status)}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.notRecorded}>No legal sections recorded for this case.</Text>
                      )}

                      <Detail label="Chargesheet" value={item.chargesheet_id} />
                      <Detail label="Chargesheet Status" value={item.chargesheet_status} />
                      <Detail label="Legal Provisions" value={item.legal_provisions} />
                      <Detail label="Legal / Investigation Outcome" value={item.legal_outcome} emphasis />

                      {!item.legal_outcome ? (
                        <Text style={styles.notRecorded}>
                          No final legal outcome is recorded in the current CINTRA database.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BlockTitle({ icon, title }) {
  return (
    <View style={styles.blockTitleRow}>
      <Ionicons name={icon} size={17} color="#173F6B" />
      <Text style={styles.blockTitle}>{title}</Text>
    </View>
  );
}

function Detail({ label, value, emphasis = false }) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, emphasis && styles.detailEmphasis]}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9EF',
  },
  backButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#EAF1F8', alignItems: 'center', justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#173F6B', letterSpacing: 1 },
  headerSubtitle: { fontSize: 10.5, color: '#738297', marginTop: 2 },
  content: { padding: 18, paddingBottom: 42 },
  searchCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E1E8EF',
  },
  label: { fontSize: 10.5, fontWeight: '800', color: '#526B82', letterSpacing: 0.8 },
  inputRow: {
    height: 50, borderWidth: 1, borderColor: '#CED9E4', borderRadius: 10,
    marginTop: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center',
  },
  input: { flex: 1, marginLeft: 9, fontSize: 14, color: '#1B2D40' },
  searchButton: {
    height: 48, borderRadius: 10, backgroundColor: '#173F6B', marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  disabled: { opacity: 0.55 },
  searchButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  personCard: {
    marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DCE5EE', flexDirection: 'row', alignItems: 'center',
  },
  personIcon: {
    width: 52, height: 52, borderRadius: 13, backgroundColor: '#EAF1F8',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  personCopy: { flex: 1 },
  personName: { fontSize: 18, fontWeight: '800', color: '#182D42' },
  personId: { fontSize: 11, fontWeight: '700', color: '#426889', marginTop: 2 },
  personMeta: { fontSize: 11, color: '#697B8D', marginTop: 4 },
  caseCountBadge: { minWidth: 52, padding: 8, backgroundColor: '#EDF3F8', borderRadius: 10, alignItems: 'center' },
  caseCount: { fontSize: 18, fontWeight: '800', color: '#173F6B' },
  caseCountLabel: { fontSize: 8.5, fontWeight: '800', color: '#667D93' },
  personDetails: { marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  sectionEyebrow: { marginTop: 24, fontSize: 10, fontWeight: '800', color: '#426889', letterSpacing: 1.1 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#182D42', marginTop: 4, marginBottom: 10 },
  caseCard: {
    backgroundColor: '#FFFFFF', borderRadius: 15, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#DCE5EE',
  },
  caseHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  caseHeaderCopy: { flex: 1, paddingRight: 10 },
  fir: { fontSize: 14, fontWeight: '900', color: '#173F6B' },
  caseTitle: { fontSize: 12, color: '#65778A', marginTop: 3 },
  statusBadge: { backgroundColor: '#EAF1F8', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  statusText: { fontSize: 9.5, fontWeight: '800', color: '#173F6B' },
  block: { borderTopWidth: 1, borderTopColor: '#E9EEF3', paddingTop: 12, marginTop: 6 },
  blockTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  blockTitle: { marginLeft: 7, fontSize: 10.5, fontWeight: '900', color: '#173F6B', letterSpacing: 0.7 },
  detailRow: { flexDirection: 'row', paddingVertical: 5 },
  detailLabel: { width: '42%', fontSize: 10.5, color: '#718196' },
  detailValue: { flex: 1, fontSize: 10.8, color: '#2D4156', fontWeight: '600' },
  detailEmphasis: { color: '#173F6B', fontWeight: '800' },
  longText: { fontSize: 10.8, color: '#53677A', lineHeight: 16, marginTop: 4 },
  legalItem: { backgroundColor: '#F5F8FB', borderRadius: 9, padding: 10, marginBottom: 7 },
  legalSection: { fontSize: 10.5, fontWeight: '900', color: '#173F6B' },
  legalName: { fontSize: 10.5, color: '#2F455A', marginTop: 2 },
  legalMeta: { fontSize: 9.5, color: '#748497', marginTop: 3 },
  notRecorded: { fontSize: 10.5, color: '#7B8998', fontStyle: 'italic', lineHeight: 15, marginVertical: 4 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#DCE5EE' },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#30485F', marginTop: 8 },
  emptyText: { fontSize: 10.5, color: '#718196', textAlign: 'center', lineHeight: 16, marginTop: 4 },
});
