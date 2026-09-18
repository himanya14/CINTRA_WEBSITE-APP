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
import { verifyMFA } from '../services/authService';

export default function MFAScreen({ navigation, route }) {
  const challengeToken = route?.params?.challengeToken || '';
  const officer = route?.params?.officer || null;
  const setupRequired = Boolean(route?.params?.mfaSetupRequired);
  const mfaSecret = route?.params?.mfaSecret || '';
  const provisioningUri = route?.params?.provisioningUri || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    const clean = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) {
      Alert.alert('Authenticator Code', 'Enter the current 6-digit code from your authenticator app.');
      return;
    }

    try {
      setLoading(true);
      await verifyMFA(challengeToken, clean);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (error) {
      Alert.alert('Verification Failed', error?.message || 'Unable to verify authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.replace('Login')}>
          <Ionicons name="arrow-back" size={22} color="#0B4C8C" />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="keypad-outline" size={34} color="#0B4C8C" />
        </View>

        <Text style={styles.kicker}>CINTRA MULTI-FACTOR AUTHENTICATION</Text>
        <Text style={styles.title}>Authenticator verification</Text>
        <Text style={styles.subtitle}>
          {officer?.officer_id ? `Officer ${officer.officer_id} · ` : ''}
          Enter the same 6-digit authenticator code used by the CINTRA website.
        </Text>

        {setupRequired ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>FIRST-TIME AUTHENTICATOR SETUP</Text>
            <Text style={styles.setupText}>
              Add a new account in Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app using this secret, then enter the generated 6-digit code below.
            </Text>
            <Text style={styles.secretLabel}>SETUP SECRET</Text>
            <Text selectable style={styles.secret}>{mfaSecret || 'Not returned by backend'}</Text>
            {provisioningUri ? (
              <Text selectable style={styles.uri} numberOfLines={3}>{provisioningUri}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>6-DIGIT AUTHENTICATOR CODE</Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            placeholder="000000"
            placeholderTextColor="#A0A8B2"
            style={styles.codeInput}
            editable={!loading}
            onSubmitEditing={handleVerify}
          />

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.disabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.verifyText}>VERIFY & CONTINUE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color="#46627D" />
          <Text style={styles.noteText}>
            The mobile app does not generate a separate OTP. It verifies the website account's TOTP challenge against the same PostgreSQL officer record.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  back: { position: 'absolute', top: 18, left: 22, width: 42, height: 42, borderRadius: 21, backgroundColor: '#E7F0FA', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 18, backgroundColor: '#E7F0FA', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  kicker: { textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#0B4C8C' },
  title: { textAlign: 'center', fontSize: 25, fontWeight: '800', color: '#16283A', marginTop: 7 },
  subtitle: { textAlign: 'center', color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  setupCard: { backgroundColor: '#EEF6FF', borderWidth: 1, borderColor: '#C9DFF5', borderRadius: 13, padding: 14, marginBottom: 14 },
  setupTitle: { fontSize: 11, fontWeight: '800', color: '#0B4C8C', letterSpacing: 0.7 },
  setupText: { marginTop: 7, fontSize: 12, lineHeight: 18, color: '#455A70' },
  secretLabel: { marginTop: 12, fontSize: 10, fontWeight: '800', color: '#64748B' },
  secret: { marginTop: 4, fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: '#16283A', letterSpacing: 1 },
  uri: { marginTop: 8, fontSize: 10, lineHeight: 14, color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 19, borderWidth: 1, borderColor: '#DDE5EE', elevation: 2 },
  label: { fontSize: 11, fontWeight: '800', color: '#506072', letterSpacing: 0.7, textAlign: 'center' },
  codeInput: { height: 62, marginTop: 12, borderWidth: 1, borderColor: '#BFCAD6', borderRadius: 11, textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 10, color: '#13283B', backgroundColor: '#FAFCFE' },
  verifyButton: { height: 52, marginTop: 16, borderRadius: 10, backgroundColor: '#0B4C8C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  verifyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  disabled: { opacity: 0.65 },
  note: { flexDirection: 'row', gap: 8, marginTop: 16, padding: 12, borderRadius: 11, backgroundColor: '#EAF0F6' },
  noteText: { flex: 1, color: '#526779', fontSize: 11, lineHeight: 16 },
});
