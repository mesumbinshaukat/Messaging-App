import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import api from '../utils/api';
import { hashForSync } from '../utils/crypto';
import { getAllLocalContacts, saveContact } from '../utils/database';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@react-navigation/native';

export default function ChatListScreen({ navigation }) {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const { user } = useAuth();
    const { colors } = useTheme();

    useEffect(() => {
        const init = async () => {
            await loadLocalContacts();
            await syncContacts();
        };
        init();
    }, []);

    const loadLocalContacts = async () => {
        const locals = await getAllLocalContacts();
        if (locals.length > 0) {
            setChats(prev => {
                const combined = [...prev, ...locals];
                // Unique by _id
                return combined.filter((v, i, a) => a.findIndex(t => t._id === v._id) === i);
            });
        }
    };

    const syncContacts = async () => {
        console.log('Starting contact sync...');
        try {
            console.log('Requesting contacts permissions...');
            const { status } = await Contacts.requestPermissionsAsync();
            console.log('Contacts permission status:', status);

            if (status !== 'granted') {
                console.log('Permissions denied');
                setLoading(false);
                return;
            }

            console.log('Fetching contacts from device...');
            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
            });
            console.log(`Found ${data.length} contacts on device`);

            if (data.length > 0) {
                const hashes = [];
                for (const contact of data) {
                    if (contact.phoneNumbers) {
                        for (const p of contact.phoneNumbers) {
                            hashes.push(await hashForSync(p.number));
                        }
                    }
                }

                const response = await api.post('/contacts/sync', { hashes: hashes });
                // Simulate recent messages for UI
                const enrichedChats = response.data.map(c => ({
                    ...c,
                    lastMessage: 'Tap to start chatting',
                    time: '12:00 PM'
                }));
                setChats(enrichedChats);
            }
        } catch (err) {
            console.error('Sync failed', err);
        } finally {
            setLoading(false);
        }
    };

    const addUser = async () => {
        if (!searchInput.trim()) {
            Alert.alert('Error', 'Please enter a phone number or email');
            return;
        }

        try {
            // Hash the input and search for user
            const hash = await hashForSync(searchInput.trim());
            const response = await api.post('/contacts/sync', { hashes: [hash] });

            if (response.data.length === 0) {
                Alert.alert('Not Found', 'No user found with this phone/email');
                return;
            }

            const foundUser = response.data[0];

            // Check if already in chats
            if (chats.find(c => c._id === foundUser._id)) {
                Alert.alert('Already Added', 'This user is already in your chat list');
                setModalVisible(false);
                setSearchInput('');
                return;
            }

            // Add to chats
            const newChat = {
                ...foundUser,
                lastMessage: 'Tap to start chatting',
                time: 'Now'
            };

            await saveContact(newChat); // Persist locally!

            setChats(prev => [...prev, newChat]);
            setModalVisible(false);
            setSearchInput('');
            Alert.alert('Success', `${foundUser.displayName} added to your chats!`);
        } catch (err) {
            console.error('Add user error:', err);
            const msg = err.response?.data?.message || 'Failed to add user. Check your connection.';
            Alert.alert('Error', msg);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.chatRow, { borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate('ChatRoom', { recipient: item })}
        >
            <View style={[styles.avatar, { backgroundColor: '#3d4a52' }]}>
                <Text style={styles.avatarText}>{item.displayName ? item.displayName.charAt(0).toUpperCase() : '?'}</Text>
            </View>
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={[styles.name, { color: colors.text }]}>{item.displayName}</Text>
                    <Text style={styles.time}>{item.time}</Text>
                </View>
                <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.notification} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <FlatList
                    data={chats}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No contacts found on the app yet.</Text>
                    }
                />

                {/* Add User Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Add User</Text>
                                <TextInput
                                    style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                                    placeholder="Enter phone or email"
                                    placeholderTextColor="#8696a0"
                                    value={searchInput}
                                    onChangeText={setSearchInput}
                                    autoCapitalize="none"
                                />
                                <View style={styles.modalButtons}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, styles.cancelButton]}
                                        onPress={() => {
                                            setModalVisible(false);
                                            setSearchInput('');
                                        }}
                                    >
                                        <Text style={styles.buttonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: colors.notification }]}
                                        onPress={addUser}
                                    >
                                        <Text style={[styles.buttonText, { color: '#111b21' }]}>Add</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* Floating Action Button */}
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.notification }]}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    chatRow: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 0.5 },
    avatar: { width: 55, height: 55, borderRadius: 27.5, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#8696a0', fontSize: 24, fontWeight: 'bold' },
    chatInfo: { flex: 1, marginLeft: 15 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    name: { fontSize: 17, fontWeight: 'bold' },
    time: { color: '#8696a0', fontSize: 12 },
    lastMsg: { color: '#8696a0', fontSize: 14 },
    emptyText: { color: '#8696a0', textAlign: 'center', marginTop: 50, fontSize: 16 },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    fabText: { color: '#111b21', fontSize: 32, fontWeight: 'bold' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        borderRadius: 15,
        padding: 25,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        borderWidth: 1.5,
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        marginHorizontal: 5,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#3d4a52',
    },
    buttonText: {
        color: '#e9edef',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
