import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function ConnectionBanner({ transport }) {
  const [visible, setVisible] = useState(false);
  const opacity = new Animated.Value(0);
  
  const configs = {
    websocket: { color: '#00a884', text: '🟢 Connected', hide: true },
    polling:   { color: '#e5a50a', text: '🟡 Server polling (slower)' },
    ble:       { color: '#4a90d9', text: '🔵 BLE mesh active' },
    sms:       { color: '#7b68ee', text: '📱 SMS fallback active' },
    disconnected: { color: '#ff4444', text: '🔴 Offline — messages queued' },
  };
  
  const config = configs[transport] || configs.disconnected;
  
  useEffect(() => {
    setVisible(true);
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    
    if (config.hide) {
      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
          () => setVisible(false)
        );
      }, 2000);
    }
  }, [transport]);
  
  if (!visible) return null;
  
  return (
    <Animated.View style={[styles.banner, { backgroundColor: config.color, opacity }]}>
      <Text style={styles.text}>{config.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
