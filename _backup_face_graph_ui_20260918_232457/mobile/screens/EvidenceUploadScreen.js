import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function EvidenceUploadScreen({ navigation }) {

  const evidenceTypes = [
    {
      type: 'Image',
      icon: 'image',
    },
    {
      type: 'Video',
      icon: 'videocam',
    },
    {
      type: 'Audio',
      icon: 'mic',
    },
    {
      type: 'Document',
      icon: 'document-text',
    },
  ];

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
          UPLOAD EVIDENCE
        </Text>

        <View style={{ width: 42 }} />

      </View>

      <Text style={styles.title}>
        Select Evidence Type
      </Text>

      <Text style={styles.description}>
        Choose the type of evidence you want
        to upload to the investigation.
      </Text>

      {/* Evidence Options */}
      {evidenceTypes.map((item) => (

        <TouchableOpacity
          key={item.type}
          style={styles.card}
          onPress={() =>
            navigation.navigate(
              'EvidenceType',
              { type: item.type }
            )
          }
        >

          <View style={styles.iconContainer}>
            <Ionicons
              name={item.icon}
              size={32}
              color="#1976D2"
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>
              {item.type.toUpperCase()}
            </Text>

            <Text style={styles.cardText}>
              Upload {item.type.toLowerCase()} evidence
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#1976D2"
          />

        </TouchableOpacity>

      ))}

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
    marginBottom: 35,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    letterSpacing: 0.8,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    letterSpacing: 0.5,
  },

  cardText: {
    fontSize: 12,
    color: '#777',
    marginTop: 5,
  },

});
