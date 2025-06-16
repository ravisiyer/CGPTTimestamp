import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    SafeAreaView,
    Text,
    Button,
    FlatList,
    Alert,
    View,
    StyleSheet,
    Platform,
    StatusBar,
    useColorScheme,
    Modal,
    Linking,
    AppState,
    TextInput,
    Pressable,
    ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { formatInterval, formatDateTime } from './util.mjs'; // Added formatDateTime
import * as Localization from 'expo-localization';
import Feather from 'react-native-vector-icons/Feather';

const STORAGE_KEY = '@timestamp_list';
const MILLISECONDS_TOGGLE_STORAGE_KEY = '@show_milliseconds_toggle'; // New storage key
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Helper function to generate a highly unique ID
const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

export default function App() {
    const [timestamps, setTimestamps] = useState([]);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [highlightedTimestampId, setHighlightedTimestampId] = useState(null);
    const [showMilliseconds, setShowMilliseconds] = useState(true); // New state for milliseconds toggle

    const [currentNoteText, setCurrentNoteText] = useState('');
    const [editingTimestampIndex, setEditingTimestampIndex] = useState(null);

    const isDark = useColorScheme() === 'dark';
    const styles = useStyles(isDark);
    const appState = useRef(AppState.currentState);
    const highlightTimeoutRef = useRef(null);
    const flatListRef = useRef(null);
    const userLocale = Localization.getLocales()[0].languageTag; // Get user locale once

    const saveTimestampsToStorage = useCallback(async (data) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error("Error saving timestamps to storage:", error);
        }
    }, []);

    const saveMillisecondsToggle = useCallback(async (value) => {
        try {
            await AsyncStorage.setItem(MILLISECONDS_TOGGLE_STORAGE_KEY, JSON.stringify(value));
        } catch (error) {
            console.error("Error saving milliseconds toggle state:", error);
        }
    }, []);

    const addTimestamp = async () => {
        const now = new Date().toISOString();
        const newTimestampEntry = { id: generateUniqueId(), time: now, note: '' };

        setTimestamps(prevTimestamps => {
            const updated = [newTimestampEntry, ...prevTimestamps].slice(0, 100);
            saveTimestampsToStorage(updated);
            if (__DEV__) { // Conditional logging for development
                console.log(`Timestamp added: ${now}`);
            }
            setHighlightedTimestampId(newTimestampEntry.id);

            if (flatListRef.current) {
                flatListRef.current.scrollToOffset({ offset: 0, animated: true });
            }
            return updated;
        });
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load timestamps
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                let parsed = stored ? JSON.parse(stored) : [];

                parsed = parsed.map(item => {
                    if (typeof item === 'string') {
                        return { id: generateUniqueId(), time: item, note: '' };
                    }
                    return { id: item.id || generateUniqueId(), time: item.time, note: item.note || '' };
                }).filter(item => item && item.time);

                setTimestamps(parsed);

                // Load milliseconds toggle state
                const storedMillisecondsToggle = await AsyncStorage.getItem(MILLISECONDS_TOGGLE_STORAGE_KEY);
                if (storedMillisecondsToggle !== null) {
                    setShowMilliseconds(JSON.parse(storedMillisecondsToggle));
                }

                // Add initial timestamp on app launch
                setTimestamps(prevTimestamps => {
                    const nowOnLoad = new Date().toISOString();
                    const initialTimestampEntry = { id: generateUniqueId(), time: nowOnLoad, note: '' };
                    const updatedOnLoad = [initialTimestampEntry, ...prevTimestamps].slice(0, 100);
                    saveTimestampsToStorage(updatedOnLoad);
                    if (__DEV__) { // Conditional logging for development
                        console.log("Initial timestamp added on app launch.");
                    }
                    // Set highlight for the initial timestamp on load
                    setHighlightedTimestampId(initialTimestampEntry.id);
                    return updatedOnLoad;
                });

            } catch (error) {
                console.error("Error loading app state:", error);
                Alert.alert("Error", "Something went wrong while loading app settings.");
            }
        };

        loadData();

        return () => {
            // Cleanup functions if any listeners were added
        };
    }, [saveTimestampsToStorage, saveMillisecondsToggle]); // Added saveMillisecondsToggle to dependencies

    useEffect(() => {
        if (highlightedTimestampId) {
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
            highlightTimeoutRef.current = setTimeout(() => {
                setHighlightedTimestampId(null);
            }, 700); // Highlight for 700ms
        }
        // Cleanup for highlight timeout
        return () => {
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
                highlightTimeoutRef.current = null;
            }
        };
    }, [highlightedTimestampId]);

    const clearTimestamps = async () => {
        if (Platform.OS === 'web') {
            const confirm = window.confirm('Clear all timestamps?');
            if (confirm) {
                await AsyncStorage.removeItem(STORAGE_KEY);
                setTimestamps([]);
            }
        } else {
            Alert.alert('Confirm', 'Clear all timestamps?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'OK',
                    onPress: async () => {
                        await AsyncStorage.removeItem(STORAGE_KEY);
                        setTimestamps([]);
                    },
                },
            ]);
        }
    };

    const exportTimestamps = async () => {
        if (timestamps.length === 0) {
            if (Platform.OS === 'web') {
                alert('No timestamps to export.');
            } else {
                Alert.alert('Info', 'No timestamps to export.');
            }
            return;
        }

        const header = `"Timestamp","Interval","Note"\n`;
        const csvBody = timestamps
            .map((entry, i) => {
                const currentTimestamp = new Date(entry.time);
                const nextEntry = timestamps[i + 1];
                const nextTimestamp = nextEntry ? new Date(nextEntry.time) : null;

                // For export, use the current showMilliseconds state
                const interval = nextTimestamp
                    ? formatInterval(currentTimestamp - nextTimestamp, showMilliseconds) // Use showMilliseconds state
                    : '';

                const safeNote = entry.note ? `"${entry.note.replace(/"/g, '""')}"` : '""';

                // For export, use formatDateTime with showMilliseconds state and isExport=true
                return `"${formatDateTime(entry.time, showMilliseconds, userLocale, true)}","${interval}",${safeNote}`;
            })
            .join('\n');

        const csv = header + csvBody;

        if (Platform.OS === 'web') {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'timestamps.csv';
            anchor.click();
            URL.revokeObjectURL(url);
        } else {
            const fileUri = FileSystem.documentDirectory + 'timestamps.csv';
            await FileSystem.writeAsStringAsync(fileUri, csv);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Error', 'Sharing not available on this platform.');
            }
        }
    };

    const openNoteModal = (index) => {
        setEditingTimestampIndex(index);
        setCurrentNoteText(timestamps[index]?.note || '');
        setIsNoteModalVisible(true);
    };

    const saveNote = () => {
        if (editingTimestampIndex !== null) {
            setTimestamps(prevTimestamps => {
                const updated = [...prevTimestamps];
                if (updated[editingTimestampIndex]) {
                    updated[editingTimestampIndex] = {
                        ...updated[editingTimestampIndex],
                        note: currentNoteText,
                    };
                }
                saveTimestampsToStorage(updated);
                return updated;
            });
            setIsNoteModalVisible(false);
            setEditingTimestampIndex(null);
            setCurrentNoteText('');
        }
    };

    const deleteTimestamp = (indexToDelete) => {
        const confirmDelete = () => {
            setTimestamps(prevTimestamps => {
                const updated = prevTimestamps.filter((_, idx) => idx !== indexToDelete);
                saveTimestampsToStorage(updated);
                return updated;
            });
            if (isNoteModalVisible && editingTimestampIndex === indexToDelete) {
                setIsNoteModalVisible(false);
                setEditingTimestampIndex(null);
                setCurrentNoteText('');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to delete this timestamp?')) {
                confirmDelete();
            }
        } else {
            Alert.alert(
                'Confirm Delete',
                'Are you sure you want to delete this timestamp?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', onPress: confirmDelete, style: 'destructive' },
                ],
                { cancelable: true }
            );
        }
    };

    const openSettingsModal = () => {
        setIsSettingsModalVisible(true);
    };

    const toggleMillisecondsDisplay = () => {
        setShowMilliseconds(prev => {
            const newValue = !prev;
            saveMillisecondsToggle(newValue);
            return newValue;
        });
    };

    const renderItem = ({ item, index }) => {
        const current = new Date(item.time);
        const prev = timestamps[index + 1]
            ? new Date(timestamps[index + 1].time)
            : null;

        // Use formatDateTime with the showMilliseconds state
        const formattedTimestampWithMs = formatDateTime(item.time, showMilliseconds, userLocale);

        const intervalMilliseconds = prev != null ? Math.abs(current - prev) : null;
        // Use formatInterval with the showMilliseconds state
        const interval = intervalMilliseconds != null ? formatInterval(intervalMilliseconds, showMilliseconds) : null;

        const isLastItem = index === timestamps.length - 1;
        const isHighlighted = item.id === highlightedTimestampId;

        return (
            <Pressable
                onPress={() => openNoteModal(index)} // Fallback for tapping anywhere else on the item
                style={({ pressed }) => [
                    styles.item,
                    isLastItem && { marginBottom: 0 },
                    pressed && styles.itemPressed,
                    isHighlighted && styles.highlightedItem
                ]}
            >
                <View style={styles.itemContentRow}>
                    <View style={styles.itemTextContent}>
                        <Text style={styles.text}>{formattedTimestampWithMs}</Text>
                        {interval && <Text style={styles.text}>Interval: {interval}</Text>}
                        {item.note ? (
                            <Text style={styles.noteText} numberOfLines={1} ellipsizeMode="tail">
                                Note: {item.note}
                            </Text>
                        ) : null}
                    </View>
                    <View style={styles.itemActions}>
                        <Pressable
                            onPress={() => openNoteModal(index)}
                            style={({ pressed }) => [styles.actionIconButton, pressed && styles.actionButtonPressed]}
                        >
                            <Feather
                                name="edit-2"
                                size={20}
                                color={isDark ? '#ccc' : '#555'}
                            />
                        </Pressable>
                        <Pressable
                            onPress={() => deleteTimestamp(index)}
                            style={({ pressed }) => [styles.actionIconButton, pressed && styles.actionButtonPressed]}
                        >
                            <Feather
                                name="trash-2"
                                size={20}
                                color={'red'}
                            />
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        );
    };

    const openBlogLink = () => {
        const url = 'https://raviswdev.blogspot.com/2025/06/using-chatgpt-to-write-react-native.html';
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <SafeAreaView style={[
            styles.container,
            Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }
        ]}>
            <StatusBar
                translucent
                backgroundColor={isDark ? '#000000' : '#ffffff'}
                barStyle={isDark ? 'light-content' : 'dark-content'}
            />

            <View style={styles.inner}>
                <Text style={styles.title}>Timestamp Tracker</Text>
                <View style={styles.buttonRow}>
                    <Pressable onPress={addTimestamp} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
                        <View style={styles.iconButtonContent}>
                            <Feather name="plus-circle" size={18} color={'#fff'} />
                            <Text style={[styles.iconButtonText, { color: '#fff' }]}>Add</Text>
                        </View>
                    </Pressable>

                    <Pressable onPress={exportTimestamps} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
                        <View style={styles.iconButtonContent}>
                            <Feather name="share" size={18} color={'#fff'} />
                            <Text style={[styles.iconButtonText, { color: '#fff' }]}>Export</Text>
                        </View>
                    </Pressable>

                    {/* Milliseconds Toggle Button */}
                    <Pressable onPress={toggleMillisecondsDisplay} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
                        <View style={styles.iconButtonContent}>
                            <Feather name={showMilliseconds ? "eye" : "eye-off"} size={18} color={'#fff'} />
                            <Text style={[styles.iconButtonText, { color: '#fff' }]}>MS {showMilliseconds ? 'On' : 'Off'}</Text>
                        </View>
                    </Pressable>

                    <Pressable onPress={clearTimestamps} style={({ pressed }) =>
                        [styles.iconButton, { backgroundColor: 'rgb(44, 4, 4)' }, pressed && styles.iconButtonPressed]}>
                        <View style={[styles.iconButtonContent, { backgroundColor: 'rgb(44, 4, 4)' }]}>
                            <Feather name="trash-2" size={18} color={'red'} />
                            <Text style={[styles.iconButtonText, { color: 'red' }]}>Clear</Text>
                        </View>
                    </Pressable>

                    <Pressable onPress={() => setIsInfoModalVisible(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
                        <View style={styles.iconButtonContent}>
                            <Feather name="info" size={18} color={'#fff'} />
                            <Text style={[styles.iconButtonText, { color: '#fff' }]}>Info</Text>
                        </View>
                    </Pressable>

                    {/* Settings Button - COMMENTED OUT as per user request */}
                    {/*
                    <Pressable onPress={openSettingsModal} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
                        <View style={styles.iconButtonContent}>
                            <Feather name="settings" size={24} color={'#fff'} />
                            <Text style={[styles.iconButtonText, { color: '#fff' }]}>Settings</Text>
                        </View>
                    </Pressable>
                    */}
                </View>
                <FlatList
                    ref={flatListRef}
                    style={styles.list}
                    contentContainerStyle={{ paddingBottom: 0 }}
                    data={timestamps}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
                <View style={styles.bottomButtons}>
                    <Pressable onPress={addTimestamp} style={({ pressed }) => [styles.largeButton, pressed && styles.largeButtonPressed]}>
                        <View style={styles.largeButtonContent}>
                            <Feather name="plus-circle" size={18} color={'#fff'} />
                            <Text style={[styles.largeButtonText, { color: '#fff' }]}>Add Timestamp</Text>
                        </View>
                    </Pressable>
                </View>
            </View>

            {/* Info Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isInfoModalVisible}
                onRequestClose={() => setIsInfoModalVisible(false)}
            >
                {/* Pressable for outside tap to close */}
                <Pressable style={styles.centeredView} onPress={() => setIsInfoModalVisible(false)}>
                    <Pressable style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9', justifyContent: 'space-between' }]} onPress={(e) => e.stopPropagation()}>
                        {/* Scrollable content */}
                        <ScrollView contentContainerStyle={styles.infoModalContent}>
                            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>About This App</Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                This is a launch and one-touch-add timestamp recorder app with facility to add a note
                                to any timestamp entry. It automatically creates a timestamp when the app is launched.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Add (Timestamp) buttons:</Text> Adds timestamp
                                and shows the interval from last timestamp.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Export button:</Text> Exports timestamps data as .csv.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>MS Toggle button:</Text> Toggles display of milliseconds in the main list.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Clear (All) button:</Text> Clears all timestamps.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Tap/Click on timestamp:</Text> Shows modal to view/edit note (always displays milliseconds).
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>App author:</Text> Ravi S. Iyer with assistance from ChatGPT and Gemini
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>App date:</Text> 16 Jun. 2025
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ color: isDark ? '#87CEEB' : 'blue', textDecorationLine: 'underline' }} onPress={openBlogLink}>
                                    More info (blog post)
                                </Text>
                            </Text>
                        </ScrollView>
                        {/* Dismiss Button - always at the bottom */}
                        <Pressable
                            onPress={() => setIsInfoModalVisible(false)}
                            style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, styles.infoDismissButton]}
                        >
                            <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Dismiss</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Timestamp Note Editor Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isNoteModalVisible}
                onRequestClose={() => setIsNoteModalVisible(false)}
            >
                {/* Pressable for outside tap to close */}
                <Pressable style={styles.centeredView} onPress={() => setIsNoteModalVisible(false)}>
                    <Pressable style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]} onPress={(e) => e.stopPropagation()}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                            Edit Timestamp Note
                        </Text>
                        {editingTimestampIndex !== null && (
                            <>
                                <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333', marginBottom: 5, alignSelf: 'flex-start' }]}>
                                    Timestamp: {formatDateTime(timestamps[editingTimestampIndex]?.time || '', true, userLocale)} {/* Always true for modal */}
                                </Text>
                                <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333', marginBottom: 15, alignSelf: 'flex-start' }]}>
                                    Interval: {
                                        timestamps[editingTimestampIndex + 1]
                                            ? formatInterval(new Date(timestamps[editingTimestampIndex]?.time) - new Date(timestamps[editingTimestampIndex + 1]?.time), true) // Always true for modal
                                            : 'N/A'
                                    }
                                </Text>
                            </>
                        )}
                        <TextInput
                            style={[
                                styles.noteInput,
                                {
                                    backgroundColor: isDark ? '#444' : '#fff',
                                    color: isDark ? '#eee' : '#000',
                                    borderColor: isDark ? '#666' : '#ccc',
                                },
                            ]}
                            placeholder="Add a note..."
                            placeholderTextColor={isDark ? '#888' : '#aaa'}
                            multiline={true}
                            numberOfLines={6}
                            value={currentNoteText}
                            onChangeText={setCurrentNoteText}
                        />
                        <View style={styles.modalButtonRow}>
                            <Pressable onPress={saveNote} style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, { flex: 1 }]}>
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Save Note</Text>
                            </Pressable>
                            <Pressable onPress={() => setIsNoteModalVisible(false)} style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, { backgroundColor: 'grey', flex: 1 }]}>
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Settings Modal (Placeholder) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isSettingsModalVisible}
                onRequestClose={() => setIsSettingsModalVisible(false)}
            >
                {/* Pressable for outside tap to close */}
                <Pressable style={styles.centeredView} onPress={() => setIsSettingsModalVisible(false)}>
                    <Pressable style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]} onPress={(e) => e.stopPropagation()}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                            Settings
                        </Text>
                        <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                            This is where settings options will go.
                        </Text>
                        <Button title="Dismiss" onPress={() => setIsSettingsModalVisible(false)} />
                    </Pressable>
                </Pressable>
            </Modal>

        </SafeAreaView>
    );
}

const useStyles = (isDark) =>
    StyleSheet.create({
        container: {
            flex: 1,
            // padding: 20, // Seems to have no effect on web!
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: isExpoGo ? 50 : 10,
            // marginBottom: isExpoGo ? 10 : 0,
            backgroundColor: isDark ? '#000' : '#fff',
        },
        inner: {
            flex: 1,
            maxWidth: 800,
            alignSelf: 'center',
            width: '100%',
        },
        title: {
            fontSize: 24,
            fontWeight: 'bold',
            color: isDark ? '#fff' : '#000',
        },
        buttonRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            marginTop: 10,
            // marginVertical: 10,
            flexWrap: 'wrap',
            // gap: 5,
        },
        iconButton: {
            backgroundColor: '#007bff', // Consistent blue
            borderRadius: 8,
            paddingVertical: 2,
            paddingHorizontal: 2,
            flex: 1,
            minWidth: 45,
            // minWidth: 65,
            maxWidth: 50,
            // maxWidth: 80,
            alignItems: 'center',
            justifyContent: 'center',
            aspectRatio: 1,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
        },
        iconButtonPressed: {
            opacity: 0.7,
        },
        iconButtonContent: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconButtonText: {
            fontSize: 11,
            marginTop: 2,
            fontWeight: 'bold',
            color: '#fff', // Consistent white
            textAlign: 'center',
        },
        list: {
            flex: 1,
            marginVertical: 10,
        },
        item: {
            padding: 10,
            marginBottom: 8,
            backgroundColor: isDark ? '#222' : '#f9f9f9', // Slightly off-white for light mode
            borderRadius: 8,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
        },
        itemPressed: {
            opacity: 0.7,
        },
        highlightedItem: {
            // Updated for better visibility in dark mode
            backgroundColor: isDark ? 'rgba(128, 255, 0, 0.3)' : (Platform.OS === 'web' ? 'rgba(0, 123, 255, 0.4)' : 'rgba(0, 123, 255, 0.2)'),
            borderWidth: 2,
            borderColor: isDark ? '#80FF00' : '#007bff', // Lime green border for dark mode
        },
        itemContentRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        itemTextContent: {
            flex: 1, // Takes up remaining space
            marginRight: 10, // Space before icons
        },
        itemActions: { // New style for the icon buttons container at the end of the row
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5, // Space between edit and delete icons
        },
        actionIconButton: { // Style for the individual edit/delete icon buttons
            padding: 12, // Increased tappable area
            borderRadius: 8, // Slightly more rounded for touch comfort
            // Optional: background for these could be slightly transparent or different
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        },
        actionButtonPressed: {
            opacity: 0.5,
        },
        pencilIcon: {
            // This style is effectively replaced by actionIconButton for consistency
        },
        text: {
            color: isDark ? '#fff' : '#111', // Darker text for light mode
        },
        noteText: {
            color: isDark ? '#ccc' : '#444', // Darker note text for light mode
            fontSize: 14,
            marginTop: 5,
        },
        bottomButtons: {
            backgroundColor: isDark ? '#000' : '#fff', // Ensure background matches container in dark/light mode
            paddingHorizontal: 10,
        },
        largeButton: {
            backgroundColor: '#007bff', // Consistent blue
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
        },
        largeButtonPressed: {
            opacity: 0.8,
        },
        largeButtonContent: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        largeButtonText: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#fff', // Consistent white
        },
        centeredView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        modalView: {
            margin: 20,
            borderRadius: 20,
            padding: 35,
            alignItems: 'center', // Keep for general centering of modal content, overridden by ScrollView width and justifyContent.
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            width: '90%',
            maxWidth: 600,
            maxHeight: '80%', // Make modal taller
            justifyContent: 'space-between',
        },
        modalTitle: {
            fontSize: 22,
            fontWeight: 'bold',
            marginBottom: 15,
            textAlign: 'center',
        },
        modalText: {
            marginBottom: 10,
            fontSize: 16,
            textAlign: 'left',
            // No width: '100%' here, it will naturally wrap within the ScrollView.
        },
        modalButtonRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            width: '100%',
            marginTop: 15,
            gap: 10,
        },
        modalButton: {
            backgroundColor: '#007bff', // Blue background for Save
            borderRadius: 8, // Rounded corners
            paddingVertical: 14, // Increased padding
            paddingHorizontal: 15,
            alignItems: 'center', // Center content horizontally
            justifyContent: 'center', // Center content vertically
            // Removed flex: 1 from here
        },
        modalButtonPressed: {
            opacity: 0.7,
        },
        modalButtonText: {
            fontSize: 16,
            fontWeight: 'bold',
            color: '#fff', // White text
            textAlign: 'center', // Ensure text is centered within the button
        },
        noteInput: {
            width: '100%',
            minHeight: 120,
            maxHeight: 250,
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
            marginBottom: 20,
            textAlignVertical: 'top',
        },
        infoModalContent: {
            paddingBottom: 20,
            width: '100%', // Crucial for text wrapping on Android
            alignItems: 'flex-start', // Align text to the left
        },
        infoDismissButton: {
            width: '100%', // Take full width
            marginTop: 20,
        },
    });
