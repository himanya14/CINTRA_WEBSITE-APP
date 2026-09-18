import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  getCurrentUser,
  logout,
} from '../services/authService';

export default function HomeScreen({ navigation }) {
  const user = getCurrentUser();

  const badgeId = user?.officer_id || user?.badgeId || '—';

  const handleLogout = () => {
    logout();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'Login',
        },
      ],
    });
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            CINTRA
          </Text>

          <Text style={styles.headerSubtitle}>
            Criminal Network Analysis
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color="#1976D2"
          />
        </TouchableOpacity>
      </View>


      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Officer Card */}
        <View style={styles.officerCard}>

          <View style={styles.officerIcon}>
            <Ionicons
              name="person"
              size={27}
              color="#1976D2"
            />
          </View>

          <View style={styles.officerInfo}>
            <Text style={styles.officerLabel}>
              AUTHENTICATED OFFICER
            </Text>

            <Text style={styles.badgeId}>
              Officer ID: {badgeId}
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                Secure Session Active
              </Text>
            </View>
          </View>

        </View>


        {/* Welcome */}
        <View style={styles.welcomeSection}>

          <Text style={styles.welcomeTitle}>
            Welcome to CINTRA
          </Text>

          <Text style={styles.welcomeText}>
            Select an operation below to begin
            your investigation.
          </Text>

        </View>


        {/* Scan Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Scanner')}
          activeOpacity={0.8}
        >

          <View style={styles.actionIcon}>
            <Ionicons
              name="scan"
              size={28}
              color="#1976D2"
            />
          </View>

          <View style={styles.actionContent}>

            <Text style={styles.actionTitle}>
              Face Scanner
            </Text>

            <Text style={styles.actionDescription}>
              Scan and identify a suspect using
              facial recognition.
            </Text>

          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#1976D2"
          />

        </TouchableOpacity>


        {/* Database Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('DatabaseSearch')
          }
          activeOpacity={0.8}
        >

          <View style={styles.actionIcon}>
            <Ionicons
              name="search"
              size={28}
              color="#1976D2"
            />
          </View>

          <View style={styles.actionContent}>

            <Text style={styles.actionTitle}>
              Database Search
            </Text>

            <Text style={styles.actionDescription}>
              Search the suspect database for
              existing records.
            </Text>

          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#1976D2"
          />

        </TouchableOpacity>


        {/* Evidence Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('EvidenceUpload')
          }
          activeOpacity={0.8}
        >

          <View style={styles.actionIcon}>
            <Ionicons
              name="document-text"
              size={28}
              color="#1976D2"
            />
          </View>

          <View style={styles.actionContent}>

            <Text style={styles.actionTitle}>
              Evidence
            </Text>

            <Text style={styles.actionDescription}>
              Upload and securely process
              digital evidence.
            </Text>

          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#1976D2"
          />

        </TouchableOpacity>


        {/* Capture Evidence Card */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            navigation.navigate('CaptureEvidence')
          }
          activeOpacity={0.8}
        >

          <View style={styles.actionIcon}>
            <Ionicons
              name="camera"
              size={28}
              color="#1976D2"
            />
          </View>

          <View style={styles.actionContent}>

            <Text style={styles.actionTitle}>
              Capture Evidence
            </Text>

            <Text style={styles.actionDescription}>
              Capture photographic evidence for
              forensic analysis.
            </Text>

          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#1976D2"
          />

        </TouchableOpacity>


        {/* Security Information */}
        <View style={styles.securityCard}>

          <View style={styles.securityIcon}>
            <Ionicons
              name="shield-checkmark"
              size={22}
              color="#1976D2"
            />
          </View>

          <View style={styles.securityContent}>

            <Text style={styles.securityTitle}>
              SECURE SESSION
            </Text>

            <Text style={styles.securityText}>
              Session automatically expires after
              60 seconds of inactivity.
            </Text>

          </View>

        </View>

      </ScrollView>

    </View>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    elevation: 3,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1.5,
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    padding: 20,
    paddingBottom: 35,
  },

  officerCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  officerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  officerInfo: {
    marginLeft: 13,
    flex: 1,
  },

  officerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.7,
  },

  badgeId: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#1976D2',
    marginRight: 6,
  },

  statusText: {
    fontSize: 10,
    color: '#555',
  },

  welcomeSection: {
    marginBottom: 17,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },

  welcomeText: {
    fontSize: 13,
    color: '#777',
    marginTop: 5,
    lineHeight: 19,
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',

    elevation: 2,

    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionContent: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },

  actionDescription: {
    fontSize: 11,
    color: '#777',
    marginTop: 4,
    lineHeight: 16,
  },

  securityCard: {
    marginTop: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 13,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  securityContent: {
    flex: 1,
    marginLeft: 11,
  },

  securityTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.5,
  },

  securityText: {
    fontSize: 10,
    color: '#666',
    marginTop: 3,
    lineHeight: 15,
  },

});