import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { login, logout } from '../services/authService';

export default function LoginScreen({ navigation }) {
  const [officerId, setOfficerId] = useState('SH-001');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanOfficerId = officerId.trim();

    if (!cleanOfficerId || !password) {
      Alert.alert(
        'Credentials Required',
        'Enter the same Officer ID and password you use on the CINTRA website.'
      );
      return;
    }

    try {
      setLoading(true);
      logout();

      const data = await login(cleanOfficerId, password);

      if (data?.access_token) {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }

      if (!data?.requires_mfa || !data?.challenge_token) {
        throw new Error('The CINTRA backend did not return an MFA challenge.');
      }

      navigation.navigate('MFA', {
        challengeToken: data.challenge_token,
        officer: data.officer || { officer_id: cleanOfficerId },
        mfaSetupRequired: Boolean(data.mfa_setup_required),
        mfaSecret: data.mfa_secret || '',
        provisioningUri: data.provisioning_uri || '',
      });
    } catch (error) {
      Alert.alert(
        'Sign In Failed',
        error?.message || 'Unable to authenticate with the CINTRA backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <View style={styles.logoIcon}>
          <Ionicons name="shield-checkmark" size={34} color="#1976D2" />
        </View>

        <Text style={styles.title}>CINTRA</Text>
        <Text style={styles.subtitle}>Secure Officer Login</Text>
      </View>

      <View style={styles.loginCard}>
        <Text style={styles.inputLabel}>OFFICER ID</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="person" size={21} color="#1976D2" />
          <TextInput
            style={styles.input}
            placeholder="Same Officer ID as website"
            placeholderTextColor="#999"
            value={officerId}
            onChangeText={setOfficerId}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
        </View>

        <Text style={[styles.inputLabel, styles.passwordLabel]}>PASSWORD</Text>
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={21} color="#1976D2" />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((value) => !value)}
            disabled={loading}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={21}
              color="#667085"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.helperText}>
          Use SH-001 with the same website password, then enter the current Authenticator code.
        </Text>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="log-in" size={21} color="#FFFFFF" />
              <Text style={styles.loginButtonText}>SIGN IN</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.securityCard}>
        <View style={styles.securityIcon}>
          <Ionicons name="shield-checkmark" size={22} color="#1976D2" />
        </View>
        <View style={styles.securityContent}>
          <Text style={styles.securityTitle}>SHARED AUTHENTICATION</Text>
          <Text style={styles.securityText}>
            Website credentials · Authenticator MFA · JWT session
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: '#F5F7FA',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 17,
    color: '#666',
    marginTop: 4,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 9,
    letterSpacing: 0.5,
  },
  passwordLabel: {
    marginTop: 18,
  },
  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D5D5D5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#667085',
    marginTop: 12,
  },
  loginButton: {
    height: 52,
    backgroundColor: '#1976D2',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  securityCard: {
    marginTop: 18,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1555A2',
    letterSpacing: 0.5,
  },
  securityText: {
    fontSize: 12,
    color: '#516173',
    marginTop: 3,
  },
});
