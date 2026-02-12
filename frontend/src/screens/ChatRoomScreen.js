import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ImageBackground, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSocket } from '../hooks/useSocket';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@react-navigation/native';
import { saveMessage, getMessages } from '../utils/database';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from '../utils/media';
import P2PService from '../services/P2PService';

export default function ChatRoomScreen({ route, navigation }) {
    const { recipient } = route.params;
    const { user } = useAuth();
    const { messages, sendMessage, setMessages } = useSocket();
    const [input, setInput] = useState('');
    const [localMessages, setLocalMessages] = useState([]);
    const { colors } = useTheme();

    useEffect(() => {
        navigation.setOptions({
            title: recipient.displayName,
            headerTitleAlign: 'left',
        });

        // Load messages from local database
        loadLocalMessages();
    }, [recipient]);

    const loadLocalMessages = async () => {
        const msgs = await getMessages(user.id, recipient._id);
        setLocalMessages(msgs);
    };

    useEffect(() => {
        navigation.setOptions({
            title: recipient.displayName,
            headerTitleAlign: 'left',
        });
    }, [recipient]);

    const handleSend = async () => {
        if (!input.trim()) return;

        try {
            console.log('Recipient object:', JSON.stringify(recipient));
            // E2E Encrypt
            const encrypted = await encryptMessage(input, recipient.publicKey);

            // Send via WebSocket if online, else P2P/SMS
            try {
                // We'll check socket state from useSocket hook (which needs to expose connected state)
                // For now, try sending via socket, if it fails or throws, go to P2P.
                // Note: socket.emit usually doesn't throw on disconnect, so we need explicit check.
                // Assuming sendMessage handles it or we add a check.
                sendMessage(recipient._id, JSON.stringify(encrypted));
            } catch (socketErr) {
                console.log('Socket send failed, trying P2P/SMS...', socketErr);
                await P2PService.sendMessage(encrypted, recipient);
            }

            // Add to local UI and database
            const myMsg = {
                senderId: user.id,
                recipientId: recipient._id,
                content: input, // Show clear text locally
                timestamp: new Date().toISOString(),
                messageId: Math.random().toString(36).substr(2, 9),
                synced: false
            };

            await saveMessage(myMsg);
            setLocalMessages((prev) => [...prev, myMsg]);
            setInput('');
        } catch (err) {
            console.error('Encryption/Send failed', err);
            if (err.message.includes('No P2P route')) {
                Alert.alert('Delivery Failed', 'No internet, Bluetooth peer, or SMS route available.');
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
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0b141a' }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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

                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                            >
                                <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
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
                            </KeyboardAvoidingView>
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
            padding: 10,
            alignItems: 'flex-end'
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
    })
};
