import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@react-navigation/native';

export default function LoginScreen({ navigation }) {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const { colors } = useTheme();

    const handleLogin = async () => {
        try {
            console.log('Login button pressed, id:', loginId);
            await login(loginId, password);
        } catch (err) {
            Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <Text style={[styles.title, { color: colors.text }]}>Private Messaging</Text>
                        <Text style={styles.subtitle}>Enter your details to login</Text>

                        <View style={styles.inputContainer}>
                            <TextInput
                                placeholder="Phone or Email"
                                placeholderTextColor="#8696a0"
                                style={[styles.input, { color: colors.text, borderBottomColor: colors.border }]}
                                value={loginId}
                                onChangeText={setLoginId}
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

                        <TouchableOpacity style={[styles.button, { backgroundColor: colors.notification }]} onPress={handleLogin}>
                            <Text style={styles.buttonText}>LOGIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.link}>Don't have an account? <Text style={{ color: colors.notification }}>Register</Text></Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 30, justifyContent: 'center' },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { color: '#8696a0', textAlign: 'center', marginBottom: 40, fontSize: 16 },
    inputContainer: { marginBottom: 30 },
    input: { borderBottomWidth: 1.5, marginBottom: 25, padding: 10, fontSize: 16 },
    button: { padding: 15, borderRadius: 25, marginTop: 10, elevation: 2 },
    buttonText: { color: '#111b21', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    link: { color: '#8696a0', textAlign: 'center', marginTop: 25, fontSize: 15 }
});
