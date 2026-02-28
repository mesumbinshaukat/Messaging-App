import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function KeyBackupModal({ visible, onDismiss }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>⚠️ Important: Backup Your Keys</Text>
          <Text style={styles.text}>
            Your private key exists ONLY on this device. If you uninstall the app or lose your phone, your messages are gone forever.
          </Text>
          <Text style={styles.text}>
            We recommend exporting your key or writing down your recovery phrase in a safe place.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onDismiss}>
            <Text style={styles.buttonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#202c33', borderRadius: 12, padding: 24, width: '100%' },
  title: { color: '#e9edef', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  text: { color: '#8696a0', fontSize: 16, lineHeight: 24, marginBottom: 12 },
  button: { backgroundColor: '#00a884', borderRadius: 25, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});
