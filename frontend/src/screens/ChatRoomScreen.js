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
import ConnectionBanner from '../components/ConnectionBanner';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export default function ChatRoomScreen({ route, navigation }) {
    const { recipient } = route.params;
    const { user } = useAuth();
    const { messages: socketMessages, sendMessage, sendTyping, setMessages: setSocketMessages, isConnected, transport } = useSocket();
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [remoteIsTyping, setRemoteIsTyping] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const typingTimeout = useRef(null);
    const [localMessages, setLocalMessages] = useState([]);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.avatarMini}>
                        <Text style={{ color: '#fff', fontSize: 16 }}>{recipient.displayName?.[0] || '?'}</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{recipient.displayName}</Text>
                        {remoteIsTyping && <Text style={{ color: '#00a884', fontSize: 12 }}>typing...</Text>}
                    </View>
                </View>
            ),
            headerRight: () => (
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={() => setIsSearching(!isSearching)} style={{ marginRight: 15 }}>
                        <MaterialIcons name="search" size={24} color="#8696a0" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile', { user: recipient })}>
                        <MaterialIcons name="info" size={24} color="#8696a0" />
                    </TouchableOpacity>
                </View>
            )
        });
    }, [navigation, recipient, remoteIsTyping, isSearching]);

    useEffect(() => {
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

                        // Check if it's my own message
                        const isMyMessage = msg.senderId.toString() === user.id.toString();
                        if (isMyMessage) {
                            // My messages are already in SQLite in plaintext
                            continue;
                        }

                        // Decrypt: nonce and senderPublicKey are required
                        const decrypted = await decryptMessage(msg.content, msg.nonce, recipient.publicKey);
                        const processed = {
                            senderId: msg.senderId.toString(),
                            recipientId: msg.recipientId.toString(),
                            content: decrypted,
                            nonce: msg.nonce,
                            timestamp: msg.timestamp,
                            messageId: msg.messageId,
                            synced: true,
                            status: 'delivered'
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
            // Process chat messages
            const newChatMessages = socketMessages.filter(m => m.senderId === recipient._id && m.type === 'chat_message');
            // Process delivery acknowledgments
            const acks = socketMessages.filter(m => m.type === 'delivery_ack');
            // Process typing indicators
            const typing = socketMessages.find(m => m.type === 'typing' && m.senderId === recipient._id);

            if (typing !== undefined) {
                setRemoteIsTyping(typing.isTyping);
            }

            if (newChatMessages.length > 0) {
                for (const msg of newChatMessages) {
                    try {
                        const decrypted = await decryptMessage(msg.content, msg.nonce, recipient.publicKey);
                        const processedMsg = {
                            senderId: msg.senderId,
                            recipientId: user.id,
                            content: decrypted,
                            nonce: msg.nonce,
                            timestamp: msg.timestamp,
                            messageId: msg.messageId,
                            synced: true,
                            status: 'delivered'
                        };
                        await saveMessage(processedMsg);
                        setLocalMessages(prev => {
                            if (prev.find(p => p.messageId === processedMsg.messageId)) return prev;
                            return [...prev, processedMsg];
                        });
                    } catch (err) { console.error(err); }
                }
            }

            if (acks.length > 0) {
                setLocalMessages(prev => prev.map(m => {
                    const ack = acks.find(a => a.messageId === m.messageId);
                    if (ack) return { ...m, status: ack.status };
                    return m;
                }));
            }

            if (newChatMessages.length > 0 || acks.length > 0 || typing !== undefined) {
                setSocketMessages(prev => prev.filter(m => {
                    if (m.type === 'typing' && m.senderId === recipient._id) return false;
                    const isProcessedChat = m.type === 'chat_message' && m.senderId === recipient._id;
                    const isProcessedAck = m.type === 'delivery_ack' && acks.find(a => a.messageId === m.messageId);
                    return !isProcessedChat && !isProcessedAck;
                }));
            }
        };

        processIncomingMessages();
    }, [socketMessages, recipient._id]);
    const handleInputChange = (text) => {
        setInput(text);
        sendTyping(recipient._id, text.length > 0);
        
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            sendTyping(recipient._id, false);
        }, 3000);
    };

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
            
            // Consistent messageId generation
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Add to local UI and database immediately (snappy UI)
            const myMsg = {
                senderId: user.id,
                recipientId: recipient._id,
                content: input,
                nonce: encryptedPacket.nonce,
                timestamp: new Date().toISOString(),
                messageId: messageId,
                synced: false,
                status: 'pending'
            };

            await saveMessage(myMsg);
            setLocalMessages((prev) => [...prev, myMsg]);
            setInput('');
            sendTyping(recipient._id, false);

            // Send via WebSocket if online, else P2P/SMS
            // We do this asynchronously to keep the UI snappy
            (async () => {
                let delivered = false;
                try {
                    delivered = sendMessage(recipient._id, encryptedPacket, messageId);
                    console.log(`[DEBUG] WS Send Attempt for ${messageId}: ${delivered ? 'SUCCESS' : 'SOCKET_OFFLINE'}`);
                } catch (socketErr) {
                    console.log(`[DEBUG] WS Send Error for ${myMsg.messageId}:`, socketErr);
                }

                if (!delivered) {
                    console.log(`[DEBUG] Switching to P2P/SMS for ${messageId}...`);
                    await P2PService.sendMessage(encryptedPacket, recipient, messageId);
                }
            })();

        } catch (err) {
            console.error('Send logic failed', err);
            Alert.alert('Error', 'Could not process message for encryption.');
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
        
        const renderStatus = () => {
            if (!isMe) return null;
            switch(item.status) {
                case 'pending': return <Text style={styles.statusIcon}>⏱</Text>;
                case 'sent': return <Text style={styles.statusIcon}>✓</Text>;
                case 'delivered': return <Text style={styles.statusIcon}>✓✓</Text>;
                default: return null;
            }
        };

        return (
            <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
                <View style={[styles.msgContainer, isMe ? styles.myMsg : styles.theirMsg]}>
                    {item.mediaUri ? (
                        <Image source={{ uri: item.mediaUri }} style={styles.mediaImage} />
                    ) : (
                        <Text style={[styles.msgText, { color: colors.text }]}>{item.content}</Text>
                    )}
                    <View style={styles.msgFooter}>
                        <Text style={styles.msgTime}>{time}</Text>
                        {renderStatus()}
                    </View>
                </View>
            </View>
        );
    };

    const filteredMessages = searchQuery.trim() 
        ? localMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
        : localMessages;

    return (
        <SafeAreaView style={styles.container}>
            <ConnectionBanner transport={transport} />
            
            {isSearching && (
                <View style={styles.searchBar}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search messages..."
                        placeholderTextColor="#8696a0"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                    />
                    <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
                        <MaterialIcons name="close" size={20} color="#8696a0" />
                    </TouchableOpacity>
                </View>
            )}
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
                            data={filteredMessages}
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
                                    onChangeText={handleInputChange}
                                    placeholder="Message"
                                    placeholderTextColor="#8696a0"
                                    multiline={true}
                                />
                            </View>
                            <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
                                <Text style={styles.attachBtnText}>📎</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.attachBtn} 
                                onPress={() => {
                                    Alert.prompt(
                                        "Paste SMS",
                                        "Paste the [PM]:nonce:content string here",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            { 
                                                text: "Decrypt", 
                                                onPress: async (text) => {
                                                    try {
                                                        if (!text.startsWith('[PM]:')) throw new Error('Invalid format');
                                                        const parts = text.split(':');
                                                        const nonce = parts[1];
                                                        const content = parts.slice(2).join(':');
                                                        const decrypted = await decryptMessage(content, nonce, recipient.publicKey);
                                                        const msg = {
                                                            senderId: recipient._id,
                                                            recipientId: user.id,
                                                            content: decrypted,
                                                            nonce: nonce,
                                                            timestamp: new Date().toISOString(),
                                                            messageId: `sms_${Date.now()}`,
                                                            status: 'delivered'
                                                        };
                                                        await saveMessage(msg);
                                                        setLocalMessages(prev => [...prev, msg].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)));
                                                    } catch (e) {
                                                        Alert.alert("Error", "Failed to decrypt SMS: " + e.message);
                                                    }
                                                }
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Text style={styles.attachBtnText}>📩</Text>
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
        fontSize: 11,
        color: 'rgba(233, 237, 239, 0.6)',
    },
    msgFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginTop: 4
    },
    statusIcon: {
        fontSize: 12,
        color: 'rgba(233, 237, 239, 0.6)',
        marginLeft: 4
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
    },
    typingContainer: {
        paddingHorizontal: 15,
        paddingVertical: 5,
        marginBottom: 10
    },
    typingText: {
        color: 'rgba(233, 237, 239, 0.6)',
        fontSize: 12,
        fontStyle: 'italic'
    }
});
