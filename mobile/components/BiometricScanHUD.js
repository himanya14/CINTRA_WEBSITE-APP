import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BiometricScanHUD({
  isScanning = false,
  onScanComplete = null,
  scanCount = 0,
  mockResult = null,
  style,
}) {
  // Scan State Cycle:
  // INITIALIZING SCANNER -> FACE DETECTED -> ANALYZING BIOMETRIC DATA -> VERIFYING MATCH -> MATCH FOUND / NO MATCH
  const [scanState, setScanState] = useState('INITIALIZING SCANNER');
  const [progress, setProgress] = useState(0);
  const [resultData, setResultData] = useState(null);

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const matchPulseAnim = useRef(new Animated.Value(0)).current;
  const glowIntensityAnim = useRef(new Animated.Value(0.4)).current;
  const statusFadeAnim = useRef(new Animated.Value(1)).current;

  // Scanning laser beam animation loop
  useEffect(() => {
    const laserLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 310,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    laserLoop.start();
    pulseLoop.start();

    return () => {
      laserLoop.stop();
      pulseLoop.stop();
    };
  }, []);

  // Smooth state transition helper with subtle fade/glitch feel
  const transitionState = (newState) => {
    Animated.sequence([
      Animated.timing(statusFadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(statusFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    setScanState(newState);
  };

  // Trigger scan sequence when isScanning changes to true
  useEffect(() => {
    if (!isScanning) return;

    let isMounted = true;
    setProgress(0);
    setResultData(null);

    // Step 1: INITIALIZING SCANNER
    transitionState('INITIALIZING SCANNER');

    const t1 = setTimeout(() => {
      if (!isMounted) return;
      transitionState('FACE DETECTED');
      setProgress(20);
    }, 500);

    // Step 2: ANALYZING BIOMETRIC DATA
    // Facial landmark dots and connecting wireframe lines have been removed.
    const t2 = setTimeout(() => {
      if (!isMounted) return;
      transitionState('ANALYZING BIOMETRIC DATA');
      setProgress(68);
    }, 1200);

    // Step 3: VERIFYING MATCH
    const t3 = setTimeout(() => {
      if (!isMounted) return;
      transitionState('VERIFYING MATCH');
      setProgress(90);
    }, 3000);

    // Step 4: FINAL RESULT (MATCH FOUND / NO MATCH)
    const t5 = setTimeout(() => {
      if (!isMounted) return;
      setProgress(100);

      // Final state comes only from the central CINTRA backend.
      // There is no alternating/demo match fallback.
      if (!mockResult || typeof mockResult.match !== 'boolean') {
        transitionState('AWAITING BACKEND');
        setProgress(95);
        return;
      }

      const res = mockResult;
      const isMatch = res.match === true;
      setResultData(res);

      if (res.match) {
        transitionState('MATCH FOUND');

        // Trigger match pulse ring
        Animated.parallel([
          Animated.timing(glowIntensityAnim, {
            toValue: 1.0,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(matchPulseAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(matchPulseAnim, {
              toValue: 0.6,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      } else {
        transitionState('NO MATCH FOUND');
        Animated.timing(glowIntensityAnim, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }

      if (onScanComplete) {
        onScanComplete(res);
      }
    }, 4500);

    return () => {
      isMounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t5);
    };
  }, [isScanning, scanCount, mockResult]);

  // Color variables according to state
  const isMatchFound = scanState === 'MATCH FOUND';
  const isNoMatch = scanState === 'NO MATCH' || scanState === 'NO MATCH FOUND';
  const themeColor = isMatchFound ? '#00FF66' : isNoMatch ? '#FF3B30' : '#00E5FF';

  return (
    <View style={[styles.container, style]}>
      {/* Background Cyber Grid Overlay */}
      <View style={styles.gridOverlay} />

      {/* Top HUD Header */}
      <View style={styles.topHudContainer}>
        <View style={styles.topHudRow}>
          <View style={styles.hudBadge}>
            <View style={[styles.indicatorDot, { backgroundColor: themeColor }]} />
            <Text style={styles.hudBadgeText}>SYS: ONLINE</Text>
          </View>

          <Text style={styles.monoMetadata}>ENC: AES-256-GCM | FPS: 60.0</Text>
        </View>

        <View style={styles.topHudRow}>
          <Text style={styles.monoMetadata}>LAT: 28.5355° N | LON: 77.3910° E</Text>
          <Text style={styles.monoMetadata}>BIO-VER: 4.9.2</Text>
        </View>
      </View>

      {/* Central Scanning Box (260x320 Frame) */}
      <View style={styles.scanBoxWrapper}>

        {/* Confirmation Pulse Ring on Match */}
        {isMatchFound && (
          <Animated.View
            style={[
              styles.matchPulseRing,
              {
                borderColor: '#00FF66',
                transform: [{ scale: pulseAnim }],
                opacity: matchPulseAnim,
              },
            ]}
          />
        )}

        {/* Corner Brackets */}
        <View style={[styles.corner, styles.cornerTL, { borderColor: themeColor }]} />
        <View style={[styles.corner, styles.cornerTR, { borderColor: themeColor }]} />
        <View style={[styles.corner, styles.cornerBL, { borderColor: themeColor }]} />
        <View style={[styles.corner, styles.cornerBR, { borderColor: themeColor }]} />

        {/* Center Target Frame Box */}
        <View style={[styles.faceTargetFrame, { borderColor: `${themeColor}40` }]}>

          {/* Vertical Scanning Beam Line */}
          {isScanning && !isMatchFound && !isNoMatch && (
            <Animated.View
              style={[
                styles.scanLaserBeam,
                {
                  top: scanLineAnim,
                  backgroundColor: themeColor,
                  shadowColor: themeColor,
                },
              ]}
            />
          )}



        </View>

        {/* Scan Percentage Count Badge */}
        <View style={styles.percentageBadge}>
          <Text style={[styles.percentageText, { color: themeColor }]}>
            {progress}%
          </Text>
        </View>
      </View>

      {/* Dynamic Status Text Readout with smooth animation */}
      <Animated.View style={[styles.statusContainer, { opacity: statusFadeAnim }]}>
        <View style={styles.statusBox}>
          <Ionicons
            name={
              isMatchFound
                ? 'checkmark-circle'
                : isNoMatch
                ? 'close-circle'
                : 'scan'
            }
            size={22}
            color={themeColor}
          />
          <Text style={[styles.statusText, { color: themeColor }]}>
            {isMatchFound ? '✓ MATCH FOUND' : isNoMatch ? 'NO MATCH FOUND' : scanState}
          </Text>
        </View>

        {/* Secondary Info banner on Match Found */}
        {isMatchFound && (
          <View style={styles.matchBanner}>
            <Text style={styles.matchBannerTitle}>IDENTITY VERIFIED</Text>
            <Text style={styles.matchBannerSub}>CONFIDENCE 98.7%</Text>
            {resultData?.suspect && (
              <Text style={styles.matchBannerSub}>
                SUSPECT ID: {resultData.suspect.suspect_id} | {resultData.suspect.name?.toUpperCase()}
              </Text>
            )}
          </View>
        )}

        {/* Secondary Info banner on No Match */}
        {isNoMatch && (
          <View style={styles.noMatchBanner}>
            <Text style={styles.noMatchTitle}>NO MATCH FOUND</Text>
            <Text style={styles.noMatchSub}>FACIAL BIOMETRIC UNRECOGNIZED</Text>
          </View>
        )}
      </Animated.View>

      {/* Bottom Technical Metadata Stream */}
      <View style={styles.bottomHudContainer}>
        <Text style={styles.monoMetadata}>
          RESULT: {resultData?.suspect?.suspect_id || resultData?.message || 'Awaiting central database'}
        </Text>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 45,
    zIndex: 15,
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },

  topHudContainer: {
    width: '90%',
    backgroundColor: 'rgba(5, 15, 25, 0.75)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },

  topHudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },

  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },

  hudBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#00E5FF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.8,
  },

  monoMetadata: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },

  scanBoxWrapper: {
    width: 260,
    height: 320,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },

  matchPulseRing: {
    position: 'absolute',
    width: 280,
    height: 340,
    borderRadius: 18,
    borderWidth: 2,
    zIndex: 2,
  },

  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    zIndex: 10,
  },

  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },

  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },

  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },

  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },

  faceTargetFrame: {
    width: 260,
    height: 320,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },

  scanLaserBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    shadowRadius: 10,
    shadowOpacity: 1,
    zIndex: 8,
  },


  percentageBadge: {
    position: 'absolute',
    bottom: -15,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },

  percentageText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  statusContainer: {
    alignItems: 'center',
    width: '90%',
  },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 15, 25, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    elevation: 5,
  },

  statusText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  matchBanner: {
    marginTop: 12,
    backgroundColor: 'rgba(0, 255, 102, 0.15)',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00FF66',
  },

  matchBannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#00FF66',
    letterSpacing: 1,
  },

  matchBannerSub: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 3,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  noMatchBanner: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },

  noMatchTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FF3B30',
    letterSpacing: 0.8,
  },

  noMatchSub: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  bottomHudContainer: {
    width: '90%',
    backgroundColor: 'rgba(5, 15, 25, 0.75)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    gap: 2,
  },
});
