import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function FaceMatchResultScreen({ navigation, route }) {
  const responseData = route?.params?.response;

  const isMatch = responseData?.match === true;
  const confidence = responseData?.confidence ?? responseData?.suspect?.confidence;

  const suspectId =
    responseData?.suspect?.suspect_id || responseData?.suspect?.id || '—';

  const suspectName =
    responseData?.suspect?.name || 'No matched person';

  const suspectStatus =
    responseData?.suspect?.status ||
    (responseData?.suspect?.wanted ? 'WANTED' : '—');

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
          MATCH RESULT
        </Text>

        <View style={{ width: 42 }} />

      </View>

      {/* Result Status */}
      <View style={styles.statusCard}>

        <View style={styles.statusIcon}>
          <Ionicons
            name={
              isMatch
                ? 'checkmark'
                : 'alert-circle'
            }
            size={42}
            color="#1976D2"
          />
        </View>

        <Text style={styles.matchTitle}>
          {isMatch
            ? 'MATCH FOUND'
            : 'NO MATCH FOUND'}
        </Text>

        <Text style={styles.confidence}>
          Confidence:{' '}
          {confidence !== undefined
            ? `${Math.round(confidence * 100)}%`
            : '—'}
        </Text>

      </View>

      {/* Suspect Details */}
      <View style={styles.detailsCard}>

        <View style={styles.cardHeader}>

          <Ionicons
            name="person"
            size={22}
            color="#1976D2"
          />

          <Text style={styles.cardHeaderText}>
            SUSPECT DETAILS
          </Text>

        </View>

        <View style={styles.photoPlaceholder}>

          <Ionicons
            name="person"
            size={55}
            color="#1976D2"
          />

          <Text style={styles.photoText}>
            SUSPECT PHOTO
          </Text>

        </View>

        <View style={styles.detailRow}>

          <Text style={styles.label}>
            Suspect ID
          </Text>

          <Text style={styles.value}>
            {suspectId}
          </Text>

        </View>

        <View style={styles.detailRow}>

          <Text style={styles.label}>
            Name
          </Text>

          <Text style={styles.value}>
            {suspectName}
          </Text>

        </View>

        <View style={styles.detailRow}>

          <Text style={styles.label}>
            Status
          </Text>

          <Text style={styles.wanted}>
            {suspectStatus}
          </Text>

        </View>

      </View>

      {/* Home Button */}
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.replace('Home')}
      >

        <Ionicons
          name="home"
          size={21}
          color="#FFFFFF"
        />

        <Text style={styles.buttonText}>
          BACK TO HOME
        </Text>

      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 15,
    backgroundColor: '#F5F7FA',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
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
    fontSize: 21,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 1,
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    elevation: 3,
    marginBottom: 18,
  },

  statusIcon: {
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  matchTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#1976D2',
  },

  confidence: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  cardHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },

  photoPlaceholder: {
    height: 150,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  photoText: {
    marginTop: 7,
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  label: {
    color: '#777',
    fontSize: 13,
  },

  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  wanted: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1976D2',
  },

  homeButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1976D2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 9,
  },

});