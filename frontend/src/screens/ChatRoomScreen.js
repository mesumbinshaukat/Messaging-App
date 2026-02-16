import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ImageBackground, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSocket } from '../hooks/useSocket';
import api from '../utils/api';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@react-navigation/native';
import { saveMessage, getMessages } from '../utils/database';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from '../utils/media';
import P2PService from '../services/P2PService';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatRoomScreen({ route, navigation }) {
    const { recipient } = route.params;
    const { user } = useAuth();
    const { messages, sendMessage, setMessages } = useSocket();
    const [input, setInput] = useState('');
    const [localMessages, setLocalMessages] = useState([]);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        navigation.setOptions({
            title: recipient.displayName,
            headerTitleAlign: 'left',
        });

        // Load messages from local database
        loadLocalMessages();
        // Sync history from server
        syncHistoryFromServer();
    }, [recipient]);

    const loadLocalMessages = async () => {
        const msgs = await getMessages(user.id, recipient._id);
        setLocalMessages(msgs);
    };

    const syncHistoryFromServer = async () => {
        try {
            console.log('Syncing history from server...');
            const response = await api.get(`/chats/${recipient._id}`);
            const serverMsgs = response.data;

            if (serverMsgs.length > 0) {
                for (const msg of serverMsgs) {
                    try {
                        // Check if already in local DB
                        const existing = localMessages.find(m => m.messageId === msg.messageId);
                        if (existing) continue;

                        // Decrypt: nonce and senderPublicKey are required
                        const decrypted = await decryptMessage(msg.content, msg.nonce, recipient.publicKey);
                        const processed = {
                            senderId: msg.senderId.toString(),
                            recipientId: msg.recipientId.toString(),
                            content: decrypted,
                            nonce: msg.nonce,
                            timestamp: msg.timestamp,
                            messageId: msg.messageId,
                            synced: true
                        };

                        await saveMessage(processed);
                        setLocalMessages(prev => {
                            if (prev.find(p => p.messageId === processed.messageId)) return prev;
                            return [...prev, processed].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                        });
                    } catch (decErr) {
                        console.error('Decryption error during history sync:', decErr);
                    }
                }
            }
        } catch (err) {
            console.error('History sync failed:', err);
        }
    };

    // REAL-TIME SYNC: Listen for messages from useSocket hook
    useEffect(() => {
        const processIncomingMessages = async () => {
            const newMessages = messages.filter(m => m.senderId === recipient._id && m.type === 'chat_message');

            if (newMessages.length > 0) {
                console.log(`Processing ${newMessages.length} real-time messages...`);

                for (const msg of newMessages) {
                    try {
                        // Decrypt incoming message
                        const decrypted = await decryptMessage(msg.content, msg.nonce, recipient.publicKey);

                        const processedMsg = {
                            senderId: msg.senderId,
                            recipientId: user.id,
                            content: decrypted,
                            nonce: msg.nonce,
                            timestamp: msg.timestamp,
                            messageId: msg.messageId,
                            synced: true
                        };

                        // Save to local DB and update UI
                        await saveMessage(processedMsg);
                        setLocalMessages(prev => {
                            // Avoid duplicates
                            if (prev.find(p => p.messageId === processedMsg.messageId)) return prev;
                            return [...prev, processedMsg];
                        });
                    } catch (err) {
                        console.error('Failed to decrypt/save incoming message:', err);
                    }
                }

                // Clear processed messages from hook state
                setMessages(prev => prev.filter(m => m.senderId !== recipient._id));
            }
        };

        processIncomingMessages();
    }, [messages, recipient._id]);


    const handleSend = async () => {
        if (!input.trim()) return;

        try {
            console.log('Recipient object:', JSON.stringify(recipient));
            if (!recipient.publicKey) {
                Alert.alert('Encryption Error', 'Recipient has no public key. They must log in once to generate keys.');
                return;
            }
            // E2E Encrypt
            const encryptedPacket = await encryptMessage(input, recipient.publicKey);

            // Send via WebSocket if online, else P2P/SMS
            let delivered = false;
            try {
                delivered = sendMessage(recipient._id, encryptedPacket);
            } catch (socketErr) {
                console.log('Socket send error:', socketErr);
            }

            if (!delivered) {
                console.log('Socket down, trying P2P/SMS...');
                await P2PService.sendMessage(encryptedPacket, recipient);
            }

            // Add to local UI and database
            const myMsg = {
                senderId: user.id,
                recipientId: recipient._id,
                content: input,
                nonce: encryptedPacket.nonce, // Store the nonce we generated
                timestamp: new Date().toISOString(),
                messageId: Math.random().toString(36).substr(2, 9),
                synced: delivered
            };

            await saveMessage(myMsg);
            setLocalMessages((prev) => [...prev, myMsg]);
            setInput('');
        } catch (err) {
            console.error('Encryption/Send failed', err);
            if (err.message.includes('No P2P route')) {
                Alert.alert('Delivery Failed', 'No internet, Bluetooth peer, or SMS route available.');
            }
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            try {
                const mediaData = await uploadMedia(result.assets[0].uri, recipient.publicKey);
                const mediaMsg = {
                    senderId: user.id,
                    recipientId: recipient._id,
                    content: '[Image]',
                    mediaUri: result.assets[0].uri,
                    timestamp: new Date().toISOString(),
                    messageId: Math.random().toString(36).substr(2, 9),
                    synced: false
                };
                await saveMessage(mediaMsg);
                setLocalMessages((prev) => [...prev, mediaMsg]);
            } catch (err) {
                Alert.alert('Error', 'Failed to send image');
            }
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.senderId === user.id;
        const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return (
            <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
                <View style={[styles.msgContainer, isMe ? styles.myMsg : styles.theirMsg]}>
                    {item.mediaUri ? (
                        <Image source={{ uri: item.mediaUri }} style={styles.mediaImage} />
                    ) : (
                        <Text style={[styles.msgText, { color: colors.text }]}>{item.content}</Text>
                    )}
                    <Text style={styles.msgTime}>{time}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0b141a' }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 25}
            >
                <View style={styles.container}>
                    <ImageBackground
                        source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }}
                        style={styles.wallpaper}
                        imageStyle={{ opacity: 0.06 }}
                    >
                        <FlatList
                            data={localMessages}
                            keyExtractor={(item) => item.messageId || item.id?.toString()}
                            renderItem={renderItem}
                            contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 20 }}
                        />

                        <View style={[
                            styles.inputContainer,
                            {
                                backgroundColor: colors.card,
                                paddingBottom: Math.max(insets.bottom, 15),
                                paddingTop: 10
                            }
                        ]}>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={input}
                                    onChangeText={setInput}
                                    placeholder="Message"
                                    placeholderTextColor="#8696a0"
                                    multiline={true}
                                />
                            </View>
                            <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
                                <Text style={styles.attachBtnText}>📎</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.notification }]} onPress={handleSend}>
                                <Text style={styles.sendBtnText}>➤</Text>
                            </TouchableOpacity>
                        </View>
                    </ImageBackground>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0b141a' },
    wallpaper: { flex: 1 },
    msgWrapper: { marginBottom: 10, width: '100%' },
    myMsgWrapper: { alignItems: 'flex-end' },
    theirMsgWrapper: { alignItems: 'flex-start' },
    msgContainer: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 15,
        maxWidth: '85%',
        elevation: 1
    },
    myMsg: {
        backgroundColor: '#005c4b',
        borderTopRightRadius: 0,
        marginRight: 5
    },
    theirMsg: {
        backgroundColor: '#202c33',
        borderTopLeftRadius: 0,
        marginLeft: 5
    },
    msgText: { fontSize: 16 },
    msgTime: {
        alignSelf: 'flex-end',
        fontSize: 11,
        color: 'rgba(233, 237, 239, 0.6)',
        marginTop: 4
    },
    inputContainer: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        alignItems: 'flex-end',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255, 255, 255, 0.1)'
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#2a3942',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 8,
        maxHeight: 120,
        marginRight: 8
    },
    input: { fontSize: 17 },
    attachBtn: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    attachBtnText: { fontSize: 24 },
    sendBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2
    },
    sendBtnText: { color: '#111b21', fontSize: 20, transform: [{ rotate: '0deg' }] },
    mediaImage: {
        width: 200,
        height: 200,
        borderRadius: 10,
        marginBottom: 5
    }
});
