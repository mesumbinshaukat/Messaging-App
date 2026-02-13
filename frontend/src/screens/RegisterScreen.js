import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../utils/api';
import { generateKeyPair } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '@react-navigation/native';

export default function RegisterScreen({ navigation }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { setUser } = useAuth();
    const { colors } = useTheme();

    const handleRegister = async () => {
        try {
            if (!name || !phone || !email || !password) {
                return Alert.alert('Error', 'Please fill all fields');
            }

            console.log('Registering user...');
            const publicKey = await generateKeyPair();

            const response = await api.post('/auth/register', {
                displayName: name,
                phoneNumber: phone,
                email: email,
                password: password,
                publicKey: publicKey
            });

            const { token, user: userData } = response.data;
            await SecureStore.setItemAsync('user_token', token);
            await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
            setUser(userData);

        } catch (err) {
            console.error(err);
            Alert.alert('Registration Failed', err.response?.data?.message || 'Something went wrong');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
                    <Text style={styles.subtitle}>Join the private network</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            placeholder="Display Name"
                            placeholderTextColor="#8696a0"
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput
                            placeholder="Phone Number"
                            placeholderTextColor="#8696a0"
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                        <TextInput
                            placeholder="Email"
                            placeholderTextColor="#8696a0"
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#8696a0"
                            style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={true}
                        />
                    </View>

                    <TouchableOpacity style={[styles.button, { backgroundColor: colors.notification }]} onPress={handleRegister}>
                        <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.link}>Already have an account? <Text style={{ color: colors.notification }}>Login</Text></Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 30, justifyContent: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { color: '#8696a0', textAlign: 'center', marginBottom: 40, fontSize: 16 },
    inputContainer: { marginBottom: 30 },
    input: { borderBottomWidth: 1.5, marginBottom: 25, padding: 10, fontSize: 16 },
    button: { padding: 15, borderRadius: 25, marginTop: 10, elevation: 2 },
    buttonText: { color: '#111b21', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    link: { color: '#8696a0', textAlign: 'center', marginTop: 25, fontSize: 15 }
});
