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

export default function FaceMatchResultScreen({ navigation, route }) {
  const responseData = route?.params?.response;
  const isMatch = responseData?.match === true;
  const confidence = responseData?.confidence ?? responseData?.suspect?.confidence;
  const confidencePercent = confidence === undefined || confidence === null
    ? null
    : (confidence <= 1 ? confidence * 100 : confidence);

  const associatedCases = Array.isArray(responseData?.suspect?.cases)
    ? responseData.suspect.cases
    : [];

  const suspectId = responseData?.suspect?.suspect_id || responseData?.suspect?.id || '—';
  const suspectName = responseData?.suspect?.name || 'No matched person';
  const suspectStatus = responseData?.suspect?.status || (responseData?.suspect?.wanted ? 'WANTED' : '—');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#173F6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MATCH RESULT</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name={isMatch ? 'checkmark' : 'alert-circle'}
              size={38}
              color="#173F6B"
            />
          </View>
          <Text style={styles.matchTitle}>{isMatch ? 'POSSIBLE MATCH' : 'NO MATCH FOUND'}</Text>
          <Text style={styles.confidence}>
            Confidence: {confidencePercent !== null ? `${Math.round(confidencePercent)}%` : '—'}
          </Text>
          <Text style={styles.reviewText}>Officer verification required before identity is confirmed.</Text>
        </View>

        {isMatch && responseData?.suspect ? (
          <View style={styles.detailsCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-outline" size={21} color="#173F6B" />
              <Text style={styles.cardHeaderText}>CENTRAL PERSON RECORD</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Person ID</Text>
              <Text style={styles.value}>{suspectId}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{suspectName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{suspectStatus}</Text>
            </View>

            <View style={styles.casesHeader}>
              <Text style={styles.casesTitle}>ASSOCIATED FIR / CASES</Text>
              <Text style={styles.caseCount}>{associatedCases.length}</Text>
            </View>

            {associatedCases.length > 0 ? associatedCases.map((item) => (
              <View key={String(item.id || item.case_id || item.fir_number)} style={styles.caseCard}>
                <Text style={styles.caseFir}>{item.fir_number || item.case_id || `Case #${item.id}`}</Text>
                {!!item.title && <Text style={styles.caseTitle}>{item.title}</Text>}
                {!!item.offence && <Text style={styles.caseMeta}>Offence: {item.offence}</Text>}
                {!!item.role_in_case && <Text style={styles.caseMeta}>Role: {item.role_in_case}</Text>}
                {!!item.status && <Text style={styles.caseMeta}>Status: {item.status}</Text>}
              </View>
            )) : (
              <View style={styles.emptyCaseCard}>
                <Text style={styles.emptyCaseText}>No linked cases found in the central CINTRA database.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{responseData?.message || 'No matching person was returned.'}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.replace('Home')}>
          <Ionicons name="home-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>BACK TO HOME</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#173F6B', letterSpacing: 1 },
  content: { padding: 20, paddingBottom: 36 },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E7ED',
    marginBottom: 14,
  },
  statusIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#EAF1F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchTitle: { fontSize: 18, fontWeight: '800', color: '#173F6B' },
  confidence: { fontSize: 13, color: '#566B80', marginTop: 5 },
  reviewText: { fontSize: 10.5, color: '#7A8795', marginTop: 6, textAlign: 'center' },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E1E7ED',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardHeaderText: { marginLeft: 7, fontSize: 12, fontWeight: '800', color: '#173F6B', letterSpacing: 0.6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
  },
  label: { color: '#768597', fontSize: 12 },
  value: { maxWidth: '62%', textAlign: 'right', color: '#263A4D', fontSize: 12, fontWeight: '700' },
  casesHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  casesTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: '#173F6B', letterSpacing: 0.6 },
  caseCount: {
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#EAF1F8',
    color: '#173F6B',
    fontWeight: '800',
  },
  caseCard: { backgroundColor: '#F6F8FA', borderRadius: 10, padding: 12, marginTop: 8 },
  caseFir: { fontSize: 13, fontWeight: '800', color: '#263A4D' },
  caseTitle: { fontSize: 11.5, color: '#4F6378', marginTop: 4 },
  caseMeta: { fontSize: 10.5, color: '#748396', marginTop: 3 },
  emptyCaseCard: { backgroundColor: '#F6F8FA', borderRadius: 10, padding: 12, marginTop: 8 },
  emptyCaseText: { fontSize: 11, color: '#748396', lineHeight: 16 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#E1E7ED' },
  emptyText: { fontSize: 12, color: '#647587', lineHeight: 18 },
  homeButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#173F6B',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginLeft: 8, letterSpacing: 0.4 },
});
