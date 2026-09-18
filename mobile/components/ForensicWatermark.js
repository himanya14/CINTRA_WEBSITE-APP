import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

export default function ForensicWatermark({
  badgeId,
  capturedAt,
}) {
  const timestamp = capturedAt
    ? new Date(capturedAt).toLocaleString()
    : 'Timestamp unavailable';

  return (
    <View
      pointerEvents="none"
      style={styles.container}
    >
      <Text style={styles.watermark}>
        CINTRA • CONFIDENTIAL
      </Text>

      <Text style={styles.details}>
        Officer: {badgeId || 'Unknown'}
      </Text>

      <Text style={styles.details}>
        {timestamp}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 15,
    alignItems: 'center',
    opacity: 0.55,
  },

  watermark: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  details: {
    fontSize: 11,
  },
});