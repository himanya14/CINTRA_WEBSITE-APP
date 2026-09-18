import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listCases, listCasePersons } from '../services/api';

export default function CasePersonSelector({
  onCaseChange,
  onPersonChange,
  compact = false,
}) {
  const [cases, setCases] = useState([]);
  const [persons, setPersons] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [personLoading, setPersonLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const rows = await listCases();
        if (!active) return;
        setCases(Array.isArray(rows) ? rows : []);
        setSelectedCase(null);
        onCaseChange?.(null);
      } catch (e) {
        if (active) setError(e?.message || 'Unable to load central cases.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCase?.id) {
      setPersons([]);
      setSelectedPerson(null);
      onPersonChange?.(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        setPersonLoading(true);
        const rows = await listCasePersons(selectedCase.id);
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setPersons(list);
        setSelectedPerson(null);
        onPersonChange?.(null);
      } catch (e) {
        if (active) {
          setPersons([]);
          setSelectedPerson(null);
          onPersonChange?.(null);
        }
      } finally {
        if (active) setPersonLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedCase?.id]);

  const chooseCase = (item) => {
    setSelectedCase(item);
    setSelectedPerson(null);
    onCaseChange?.(item);
    onPersonChange?.(null);
  };

  const choosePerson = (item) => {
    setSelectedPerson(item);
    onPersonChange?.(item);
  };

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={18} color="#0B4C8C" />
        <Text style={styles.headerText}>LINK EVIDENCE TO INVESTIGATION</Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#1976D2" />
          <Text style={styles.muted}>Loading central CINTRA cases…</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : cases.length === 0 ? (
        <Text style={styles.error}>No case exists in the shared database. Seed or restore the database first.</Text>
      ) : (
        <>
          <Text style={styles.label}>CASE / FIR — SELECT REQUIRED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {cases.map((item) => {
              const active = selectedCase?.id === item.id;
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  onPress={() => chooseCase(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>
                    {item.fir_number || item.case_id}
                  </Text>
                  <Text style={[styles.chipSub, active && styles.chipSubActive]} numberOfLines={1}>
                    {item.title || item.offence}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.personHeaderRow}>
            <Text style={styles.label}>PERSON LINK (OPTIONAL)</Text>
            {personLoading && <ActivityIndicator size="small" color="#1976D2" />}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            <TouchableOpacity
              onPress={() => choosePerson(null)}
              style={[styles.personChip, !selectedPerson && styles.personChipActive]}
            >
              <Text style={[styles.personText, !selectedPerson && styles.personTextActive]}>No person</Text>
            </TouchableOpacity>
            {persons.map((item) => {
              const active = selectedPerson?.id === item.id;
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  onPress={() => choosePerson(item)}
                  style={[styles.personChip, active && styles.personChipActive]}
                >
                  <Text style={[styles.personText, active && styles.personTextActive]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.personSub, active && styles.personTextActive]}>{item.person_id}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.helper}>
            Uploads go to the same backend/database as the website. Linking a person also updates that person's records and the relationship map.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#DCE8F5',
    elevation: 2,
  },
  compactCard: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  headerText: { marginLeft: 7, color: '#0B4C8C', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muted: { color: '#667085', fontSize: 12 },
  error: { color: '#B42318', fontSize: 12, lineHeight: 17 },
  label: { color: '#5B6472', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 7 },
  personHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  chipScroller: { marginBottom: 8 },
  chip: {
    width: 170,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#D7E2EF',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#0B4C8C', borderColor: '#0B4C8C' },
  chipTitle: { color: '#17324D', fontSize: 12, fontWeight: '800' },
  chipTitleActive: { color: '#FFFFFF' },
  chipSub: { color: '#6A7786', fontSize: 10, marginTop: 3 },
  chipSubActive: { color: '#DCEBFA' },
  personChip: {
    minWidth: 90,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#D7E2EF',
    marginRight: 8,
  },
  personChipActive: { backgroundColor: '#E3F2FD', borderColor: '#1976D2' },
  personText: { color: '#344054', fontWeight: '700', fontSize: 11 },
  personSub: { color: '#7A8795', fontSize: 9, marginTop: 2 },
  personTextActive: { color: '#0B4C8C' },
  helper: { color: '#6B7280', fontSize: 10, lineHeight: 15, marginTop: 3 },
});
