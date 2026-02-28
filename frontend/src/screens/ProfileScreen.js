import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen({ route, navigation }) {
  const { user } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.displayName?.[0] || '?'}</Text>
        </View>
        <Text style={styles.name}>{user.displayName}</Text>
        <Text style={styles.phone}>{user.phoneNumber}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Public Key Fingerprint</Text>
        <View style={styles.keyContainer}>
          <Text style={styles.keyText}>{user.publicKey?.slice(-16) || 'N/A'}</Text>
          <MaterialIcons name="verified" size={20} color="#00a884" />
        </View>
        <Text style={styles.hint}>Verify this code with your contact to ensure end-to-end encryption.</Text>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111b21', padding: 20 },
  header: { alignItems: 'center', marginVertical: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#128C7E', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  name: { color: '#e9edef', fontSize: 24, fontWeight: 'bold' },
  phone: { color: '#8696a0', fontSize: 16, marginTop: 5 },
  section: { backgroundColor: '#202c33', borderRadius: 8, padding: 15, marginTop: 20 },
  sectionLabel: { color: '#00a884', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  keyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyText: { color: '#e9edef', fontSize: 16, fontFamily: 'monospace' },
  hint: { color: '#8696a0', fontSize: 12, marginTop: 10 },
  backButton: { marginTop: 'auto', backgroundColor: '#2a3942', padding: 15, borderRadius: 25, alignItems: 'center' },
  backButtonText: { color: '#e9edef', fontWeight: 'bold' }
});
