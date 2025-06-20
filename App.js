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
const MILLISECONDS_TOGGLE_STORAGE_KEY = '@show_milliseconds_toggle';
const MAX_TIMESTAMPS = 100; // New constant for maximum timestamps
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const MAX_NOTE_LENGTH = 500; // New constant for maximum note length

// Helper function to generate a highly unique ID
const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
};

export default function App() {
    const [timestamps, setTimestamps] = useState([]);
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [isClearOptionsModalVisible, setIsClearOptionsModalVisible] = useState(false); // New state for clear options modal
    const [clearActionType, setClearActionType] = useState('deleteN'); // 'deleteN' or 'clearAll'
    const [numToDelete, setNumToDelete] = useState(0); // Number of entries to delete from end

    const [highlightedTimestampId, setHighlightedTimestampId] = useState(null);
    const [showMilliseconds, setShowMilliseconds] = useState(true);

    const [currentNoteText, setCurrentNoteText] = useState('');
    const [editingTimestampIndex, setEditingTimestampIndex] = useState(null);

    const isDark = useColorScheme() === 'dark';
    const styles = useStyles(isDark);
    const appState = useRef(AppState.currentState);
    const highlightTimeoutRef = useRef(null);
    const flatListRef = useRef(null);
    const userLocale = Localization.getLocales()[0].languageTag;

    // useRef to ensure loadData runs only once on initial mount
    const hasLoadedInitialData = useRef(false);

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

    const showAppAlert = useCallback(async (title, message) => {
        return new Promise((resolve) => {
            if (Platform.OS === 'web') {
                alert(message); // window.alert for web
                resolve(true);
            } else {
                Alert.alert(
                    title,
                    message,
                    [{ text: "OK", onPress: () => resolve(true) }],
                    { cancelable: false }
                );
            }
        });
    }, []);


    const addTimestamp = async () => {
        const currentLength = timestamps.length;
        const now = new Date().toISOString();
        const newTimestampEntry = { id: generateUniqueId(), time: now, note: '' };

        // --- Start of new logic for MAX_TIMESTAMPS handling for user-initiated adds ---
        if (currentLength >= MAX_TIMESTAMPS) {
            await showAppAlert(
                "Timestamp Data Full",
                `Timestamp data is full. Maximum entries allowed: ${MAX_TIMESTAMPS}. ` +
                "The current timestamp cannot be added. Please delete some entries or clear all " +
                "timestamps to add more."
            );
            return; // Exit function if limit is reached
        } else if (currentLength === MAX_TIMESTAMPS - 1) {
            // This is the last slot before hitting MAX_TIMESTAMPS
            await showAppAlert(
                "Timestamp Limit Warning",
                `You are about to reach the limit of ${MAX_TIMESTAMPS} timestamps. ` +
                "The current timestamp will be added, but **further additions will not be made**. " + // Updated wording
                "Please delete some entries or clear all timestamps if you wish to add more."
            );
        }
        // --- End of new logic for MAX_TIMESTAMPS handling ---

        // Proceed to add the timestamp ONLY if not already at MAX_TIMESTAMPS
        setTimestamps(prevTimestamps => {
            // Add the new timestamp to the beginning. No slicing here, as the check above now strictly prevents overgrowth.
            const updated = [newTimestampEntry, ...prevTimestamps];
            saveTimestampsToStorage(updated); // Save the exact updated array
            if (__DEV__) {
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
        // Only run this effect once on component mount
        if (hasLoadedInitialData.current) {
            return; // Skip if already loaded
        }
        hasLoadedInitialData.current = true; // Mark as loaded

        const loadData = async () => {
            try {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                let loadedParsedTimestamps = stored ? JSON.parse(stored) : [];

                // Load milliseconds toggle state
                const storedMillisecondsToggle = await AsyncStorage.getItem(MILLISECONDS_TOGGLE_STORAGE_KEY);
                if (storedMillisecondsToggle !== null) {
                    setShowMilliseconds(JSON.parse(storedMillisecondsToggle));
                }

                let finalTimestampsToSet = [];
                let alertMessage = null;
                let alertTitle = null;

                // Scenario 1: List is already full on launch (or more than MAX_TIMESTAMPS from old data, truncate silently)
                if (loadedParsedTimestamps.length >= MAX_TIMESTAMPS) {
                    finalTimestampsToSet = loadedParsedTimestamps.slice(0, MAX_TIMESTAMPS); // Truncate if somehow more were stored
                    alertTitle = "Timestamp Data Full on Launch";
                    alertMessage = `Timestamp data was full (${MAX_TIMESTAMPS} entries) when the app launched. ` +
                                   "No new timestamp was added automatically. Please delete some entries or clear all " +
                                   "timestamps if you wish to add more." ;
                    if (__DEV__) {
                        console.log("Timestamp list already full on app launch, no initial timestamp added.");
                    }
                }
                // Scenario 2: List not full, will add initial timestamp
                else {
                    const nowOnLoad = new Date().toISOString();
                    const initialTimestampEntry = { id: generateUniqueId(), time: nowOnLoad, note: '' };
                    finalTimestampsToSet = [initialTimestampEntry, ...loadedParsedTimestamps]; // Add, don't slice yet for this case

                    if (__DEV__) {
                        console.log("Initial timestamp added on app launch.");
                    }
                    setHighlightedTimestampId(initialTimestampEntry.id);


                    // Check if adding this timestamp caused the list to become full
                    if (finalTimestampsToSet.length === MAX_TIMESTAMPS) {
                        alertTitle = "Timestamp List Now Full";
                        alertMessage = `The timestamp list is now full with ${MAX_TIMESTAMPS} entries due to the initial timestamp added on launch. ` +
                                       "**Further additions will not be made**. Please delete some entries or clear all timestamps if you wish to add more." ; // Updated wording
                    }
                }

                // IMPORTANT: Save to storage *before* setting state, especially if an alert is about to show.
                // This ensures the saved state reflects the UI state correctly.
                await saveTimestampsToStorage(finalTimestampsToSet);
                setTimestamps(finalTimestampsToSet); // Update state once after all calculations

                if (alertMessage) {
                    // Use a short timeout to ensure the alert appears after initial render is complete
                    setTimeout(() => {
                        showAppAlert(alertTitle, alertMessage);
                    }, 100);
                }

            } catch (error) {
                console.error("Error loading app state:", error);
                Alert.alert("Error", "Something went wrong while loading app settings.");
            }
        };

        loadData();

        return () => {
            // Cleanup functions if any listeners were added
        };
    }, [saveTimestampsToStorage, saveMillisecondsToggle, showAppAlert]);

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

    const handleClearTimestampsPrompt = () => {
        // Calculate default numToDelete: half of current timestamps, clamped between 1 and total (if timestamps exist)
        const defaultDeleteCount = timestamps.length > 0
            ? Math.max(1, Math.floor(timestamps.length / 2))
            : 0; // If no timestamps, default to 0 to prevent errors
        setNumToDelete(defaultDeleteCount);
        setClearActionType('deleteN'); // Default to deleting N entries
        setIsClearOptionsModalVisible(true);
    };

    const handleClearConfirmed = async () => {
        let confirmMessage = "";
        let newTimestamps = [];

        if (clearActionType === 'clearAll') {
            confirmMessage = "Are you sure you want to clear ALL timestamps? This action cannot be undone.";
            newTimestamps = [];
        } else { // 'deleteN'
            const actualNumToDelete = Math.min(Math.max(0, parseInt(numToDelete || '0')), timestamps.length); // Ensure valid number
            if (actualNumToDelete === 0) {
                 await showAppAlert("No Timestamps to Delete", "Please enter a number greater than 0, or choose 'Clear All'.");
                 return; // Do not proceed with deletion
            }
            confirmMessage = `Are you sure you want to delete the last ${actualNumToDelete} timestamp entr${actualNumToDelete === 1 ? 'y' : 'ies'}? This action cannot be undone.`;
            newTimestamps = timestamps.slice(0, timestamps.length - actualNumToDelete);
        }

        // Use Alert for confirmation as per previous discussions
        if (Platform.OS === 'web') {
            if (window.confirm(confirmMessage)) {
                setTimestamps(newTimestamps);
                await saveTimestampsToStorage(newTimestamps);
                setIsClearOptionsModalVisible(false);
            }
        } else {
            Alert.alert(
                "Confirm Deletion",
                confirmMessage,
                [
                    { text: "Cancel", style: "cancel", onPress: () => { /* User cancelled */ } },
                    {
                        text: "Confirm",
                        onPress: async () => {
                            setTimestamps(newTimestamps);
                            await saveTimestampsToStorage(newTimestamps);
                            setIsClearOptionsModalVisible(false);
                        },
                        style: "destructive",
                    },
                ],
                { cancelable: true }
            );
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
                    ? formatInterval(currentTimestamp - nextTimestamp, showMilliseconds)
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

                    <Pressable
                        onPress={handleClearTimestampsPrompt}
                        disabled={timestamps.length === 0} // Disable if no timestamps
                        style={({ pressed }) => [
                            styles.iconButton,
                            { backgroundColor: 'rgb(44, 4, 4)' },
                            (pressed || timestamps.length === 0) && styles.iconButtonPressed,
                            timestamps.length === 0 && { opacity: 0.5 } // Dim if disabled
                        ]}
                    >
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

                    {/* Settings Modal (Placeholder) */}
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
                onRequestClose={() => {
                    setIsInfoModalVisible(!isInfoModalVisible);
                }}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9', justifyContent: 'space-between' }]}>
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
                                <Text style={{ fontWeight: 'bold' }}>Clear button:</Text> Clears timestamps.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Tap/Click on timestamp:</Text> Shows modal to view/edit note (always displays milliseconds).
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Maximum timestamps: </Text> {MAX_TIMESTAMPS}
                            </Text>
                             <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>Maximum note length: </Text> {MAX_NOTE_LENGTH} characters.
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>App author:</Text> Ravi S. Iyer with assistance from ChatGPT and Gemini
                            </Text>
                            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                                <Text style={{ fontWeight: 'bold' }}>App date:</Text> 20 Jun. 2025
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
                    </View>
                </View>
            </Modal>

            {/* Timestamp Note Editor Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isNoteModalVisible}
                onRequestClose={() => setIsNoteModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
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
                            maxLength={MAX_NOTE_LENGTH} // Set maximum length
                        />
                        <Text style={[styles.characterCountText, { color: isDark ? '#ccc' : '#666' }]}>
                            {currentNoteText.length}/{MAX_NOTE_LENGTH}
                        </Text>
                        <View style={styles.modalButtonRow}>
                            <Pressable onPress={saveNote} style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, { flex: 1 }]}>
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Save Note</Text>
                            </Pressable>
                            <Pressable onPress={() => setIsNoteModalVisible(false)} style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, { backgroundColor: 'grey', flex: 1 }]}>
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Clear Options Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isClearOptionsModalVisible}
                onRequestClose={() => setIsClearOptionsModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Clear Timestamps</Text>

                        <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333', marginBottom: 5, alignSelf: 'flex-start' }]}>
                            Current timestamps: <Text style={{ fontWeight: 'bold' }}>{timestamps.length}</Text>
                        </Text>
                        <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333', marginBottom: 15, alignSelf: 'flex-start' }]}>
                            Maximum timestamps: <Text style={{ fontWeight: 'bold' }}>{MAX_TIMESTAMPS}</Text>
                        </Text>

                        <View style={styles.clearOptionRow}>
                            <Pressable
                                style={[styles.clearRadioButtonContainer]} // Container for icon and text
                                onPress={() => {
                                    setClearActionType('deleteN');
                                    // Set numToDelete to default if user just selected this option and it's currently 0
                                    if (numToDelete === 0 && timestamps.length > 0) {
                                        setNumToDelete(Math.max(1, Math.floor(timestamps.length / 2)));
                                    }
                                }}
                            >
                                <Feather
                                    name={clearActionType === 'deleteN' ? "check-circle" : "circle"}
                                    size={20}
                                    color={clearActionType === 'deleteN' ? '#007bff' : (isDark ? '#ccc' : '#555')}
                                    style={styles.radioIcon}
                                />
                                <Text style={[
                                    styles.clearRadioButtonText,
                                    clearActionType === 'deleteN' ? styles.clearRadioButtonTextSelected : { color: isDark ? '#ddd' : '#333' }
                                ]}>
                                    Delete last
                                </Text>
                            </Pressable>
                            <TextInput
                                style={[
                                    styles.clearNumberInput,
                                    {
                                        backgroundColor: isDark ? '#444' : '#fff',
                                        color: isDark ? '#eee' : '#000',
                                        borderColor: isDark ? '#666' : '#ccc',
                                    },
                                    clearActionType !== 'deleteN' && { opacity: 0.5 } // Dim if not selected
                                ]}
                                keyboardType="numeric"
                                onChangeText={(text) => {
                                    let val = parseInt(text, 10);
                                    if (isNaN(val) || val < 0) val = 0;
                                    val = Math.min(val, timestamps.length); // Clamp to max timestamps
                                    setNumToDelete(val);
                                }}
                                value={String(numToDelete)}
                                editable={clearActionType === 'deleteN'}
                                selectTextOnFocus={clearActionType === 'deleteN'}
                            />
                            <Text style={[styles.clearRadioButtonText, { color: isDark ? '#ddd' : '#333' }]}>timestamps</Text>
                        </View>

                        <View style={[styles.clearOptionRow, { marginTop: 15 }]}>
                            <Pressable
                                style={[styles.clearRadioButtonContainer]} // Container for icon and text
                                onPress={() => setClearActionType('clearAll')}
                            >
                                <Feather
                                    name={clearActionType === 'clearAll' ? "check-circle" : "circle"}
                                    size={20}
                                    color={clearActionType === 'clearAll' ? '#007bff' : (isDark ? '#ccc' : '#555')}
                                    style={styles.radioIcon}
                                />
                                <Text style={[
                                    styles.clearRadioButtonText,
                                    clearActionType === 'clearAll' ? styles.clearRadioButtonTextSelected : { color: isDark ? '#ddd' : '#333' }
                                ]}>
                                    Clear all timestamps
                                </Text>
                            </Pressable>
                        </View>

                        <View style={styles.modalButtonRow}>
                            <Pressable
                                onPress={handleClearConfirmed}
                                style={({ pressed }) => [
                                    styles.modalButton,
                                    { backgroundColor: 'rgb(180, 0, 0)' }, // Red color for clear action
                                    pressed && styles.modalButtonPressed
                                ]}
                            >
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Clear</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setIsClearOptionsModalVisible(false)}
                                style={({ pressed }) => [styles.modalButton, pressed && styles.modalButtonPressed, { backgroundColor: 'grey' }]}
                            >
                                <Text style={[styles.modalButtonText, { color: '#fff', textAlign: 'center' }]}>Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Settings Modal (Placeholder) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isSettingsModalVisible}
                onRequestClose={() => setIsSettingsModalVisible(false)}
            >
                <View style={styles.centeredView}>
                    <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
                        <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                            Settings
                        </Text>
                        <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
                            This is where settings options will go.
                        </Text>
                        <Button title="Dismiss" onPress={() => setIsSettingsModalVisible(false)} />
                    </View>
                </View>
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
            marginBottom: 5, // Reduced margin to make space for character count
            textAlignVertical: 'top',
        },
        characterCountText: {
            fontSize: 12,
            alignSelf: 'flex-end', // Align to the right of the input
            marginRight: 5,
            marginBottom: 15, // Space between count and buttons
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
        // New styles for Clear Options Modal
        clearOptionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            marginBottom: 10,
            flexWrap: 'wrap', // Allow wrapping on small screens
        },
        clearRadioButtonContainer: { // New container for radio button icon + text
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 5,
            // borderWidth: 1, // Removed border from here to just surround the whole row if needed
            // borderColor: isDark ? '#666' : '#ccc',
            marginRight: 10,
        },
        radioIcon: {
            marginRight: 8, // Space between icon and text
        },
        // clearRadioButtonSelected: // No longer needed, handled by icon color
        //     backgroundColor: '#007bff',
        //     borderColor: '#007bff',
        // },
        clearRadioButtonText: {
            fontSize: 16,
        },
        clearRadioButtonTextSelected: {
            // color: '#fff', // Removed, as icon color indicates selection now
            fontWeight: 'bold',
        },
        clearNumberInput: {
            borderWidth: 1,
            borderRadius: 5,
            padding: 8,
            width: 70, // Fixed width for number input
            textAlign: 'center',
            fontSize: 16,
            marginRight: 10,
        },
    });