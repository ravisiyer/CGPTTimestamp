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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { formatInterval } from './util.mjs';
import * as Localization from 'expo-localization';
import Feather from 'react-native-vector-icons/Feather';

const STORAGE_KEY = '@timestamp_list';
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function App() {
  const [timestamps, setTimestamps] = useState([]);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
  const [isForegroundPromptVisible, setIsForegroundPromptVisible] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  // New state to highlight the most recently added timestamp
  const [highlightedTimestampId, setHighlightedTimestampId] = useState(null);

  const [currentNoteText, setCurrentNoteText] = useState('');
  const [editingTimestampIndex, setEditingTimestampIndex] = useState(null);

  const isDark = useColorScheme() === 'dark';
  const styles = useStyles(isDark);
  const appState = useRef(AppState.currentState);
  const foregroundPromptTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null); // Ref for highlight timeout

  // Helper function to update AsyncStorage
  const saveTimestampsToStorage = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving timestamps to storage:", error);
    }
  }, []);

  // Modified addTimestamp to use functional update for setTimestamps
  const addTimestamp = async () => {
    const now = new Date().toISOString();
    // Add a unique ID to each timestamp entry for reliable highlighting
    const newTimestampEntry = { id: Date.now().toString(), time: now, note: '' };

    setTimestamps(prevTimestamps => {
      const updated = [newTimestampEntry, ...prevTimestamps].slice(0, 100);
      saveTimestampsToStorage(updated);
      console.log(`Timestamp added: ${now}`);
      // Set the ID of the newly added timestamp to highlight it
      setHighlightedTimestampId(newTimestampEntry.id);
      return updated;
    });
  };

  const handleAddTimestampFromPrompt = () => {
    if (foregroundPromptTimeoutRef.current) {
      clearTimeout(foregroundPromptTimeoutRef.current);
      foregroundPromptTimeoutRef.current = null;
    }
    setIsForegroundPromptVisible(false);
    addTimestamp();
  };

  const handleDoNotAddTimestampFromPrompt = () => {
    if (foregroundPromptTimeoutRef.current) {
      clearTimeout(foregroundPromptTimeoutRef.current);
      foregroundPromptTimeoutRef.current = null;
    }
    setIsForegroundPromptVisible(false);
    console.log("User chose NOT to add timestamp on foreground, or timeout expired.");
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let parsed = stored ? JSON.parse(stored) : [];

        // Backward compatibility: Convert old string-only timestamps to objects
        // and ensure 'note' and 'id' properties exist for all entries.
        parsed = parsed.map(item => {
          if (typeof item === 'string') {
            return { id: Date.now().toString() + Math.random().toString(36).substring(2, 8), time: item, note: '' };
          }
          // Ensure existing objects also have an ID and a note (for older versions)
          return { id: item.id || Date.now().toString() + Math.random().toString(36).substring(2, 8), time: item.time, note: item.note || '' };
        }).filter(item => item && item.time); // Filter out any potentially malformed entries

        setTimestamps(parsed);

        // Add an initial timestamp when the app first loads (cold start)
        setTimestamps(prevTimestamps => {
          const nowOnLoad = new Date().toISOString();
          const initialTimestampEntry = { id: Date.now().toString(), time: nowOnLoad, note: '' };
          const updatedOnLoad = [initialTimestampEntry, ...prevTimestamps].slice(0, 100);
          saveTimestampsToStorage(updatedOnLoad);
          console.log("Initial timestamp added on app launch.");
          return updatedOnLoad;
        });

      } catch (error) {
        console.error("Error loading timestamps:", error);
        Alert.alert("Error", "Something went wrong while loading timestamps.");
      }
    };

    // AppState listener
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground! Prompting user...');
        setIsForegroundPromptVisible(true);

        if (foregroundPromptTimeoutRef.current) {
          clearTimeout(foregroundPromptTimeoutRef.current);
        }
        foregroundPromptTimeoutRef.current = setTimeout(() => {
          console.log('5-second timeout reached. Dismissing prompt.');
          handleDoNotAddTimestampFromPrompt();
        }, 5000);
      }
      appState.current = nextAppState;
    });

    loadData();

    // Cleanup for AppState listener and foreground timeout
    return () => {
      appStateSubscription.remove();
      if (foregroundPromptTimeoutRef.current) {
        clearTimeout(foregroundPromptTimeoutRef.current);
        foregroundPromptTimeoutRef.current = null;
      }
    };
  }, [saveTimestampsToStorage]);

  // Effect to handle the highlight duration
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

  const formattedTimestamp = (isoString) => {
    const date = new Date(isoString);
    const userLocale = Localization.getLocales()[0].languageTag;
    const dateTimePart = date.toLocaleString(userLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
    });
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${dateTimePart} (${milliseconds}ms)`;
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

        const interval = nextTimestamp
          ? formatInterval(currentTimestamp - nextTimestamp)
          : '';

        const safeNote = entry.note ? `"${entry.note.replace(/"/g, '""')}"` : '""';

        return `"${formattedTimestamp(entry.time)}","${interval}",${safeNote}`;
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

  const deleteTimestamp = () => {
    if (editingTimestampIndex !== null) {
      const confirmDelete = () => {
        setTimestamps(prevTimestamps => {
          const updated = prevTimestamps.filter((_, idx) => idx !== editingTimestampIndex);
          saveTimestampsToStorage(updated);
          return updated;
        });
        setIsNoteModalVisible(false);
        setEditingTimestampIndex(null);
        setCurrentNoteText('');
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
    }
  };

  const openSettingsModal = () => {
    setIsSettingsModalVisible(true);
  };

  const renderItem = ({ item, index }) => {
    const current = new Date(item.time);
    const prev = timestamps[index + 1]
      ? new Date(timestamps[index + 1].time)
      : null;

    const formattedTimestampWithMs = formattedTimestamp(item.time);

    const intervalMilliseconds = prev != null ? Math.abs(current - prev) : null;
    const interval = intervalMilliseconds != null ? formatInterval(intervalMilliseconds) : null;

    const isLastItem = index === timestamps.length - 1;
    const isHighlighted = item.id === highlightedTimestampId; // Check if current item is highlighted

    return (
      <Pressable
        onPress={() => openNoteModal(index)}
        style={({ pressed }) => [
          styles.item,
          isLastItem && { marginBottom: 0 },
          pressed && styles.itemPressed,
          isHighlighted && styles.highlightedItem // Apply highlighted style
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
          </View><Feather
            name="edit-2"
            size={20}
            color={isDark ? '#ccc' : '#555'}
            style={styles.pencilIcon}
          />
        </View>
      </Pressable>
    );
  };

  const openBlogLink = () => {
    const url = 'https://raviswdev.blogspot.com/2025/06/using-chatgpt-to-write-react-native-timestamp-app.html';
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
          {/* Add TS Button */}
          <Pressable onPress={addTimestamp} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <View style={styles.iconButtonContent}>
              <Feather name="plus-circle" size={24} color={'#fff'} />
              <Text style={[styles.iconButtonText, { color: '#fff' }]}>Add TS</Text>
            </View>
          </Pressable>

          {/* Export Button */}
          <Pressable onPress={exportTimestamps} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <View style={styles.iconButtonContent}>
              <Feather name="share" size={24} color={'#fff'} />
              <Text style={[styles.iconButtonText, { color: '#fff' }]}>Export</Text>
            </View>
          </Pressable>

          {/* Clear Button */}
          <Pressable onPress={clearTimestamps} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <View style={styles.iconButtonContent}>
              <Feather name="trash-2" size={24} color={'red'} />
              <Text style={[styles.iconButtonText, { color: 'red' }]}>Clear</Text>
            </View>
          </Pressable>

          {/* Info Button */}
          <Pressable onPress={() => setIsInfoModalVisible(true)} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <View style={styles.iconButtonContent}>
              <Feather name="info" size={24} color={'#fff'} />
              <Text style={[styles.iconButtonText, { color: '#fff' }]}>Info</Text>
            </View>
          </Pressable>

          {/* Settings Button */}
          <Pressable onPress={openSettingsModal} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <View style={styles.iconButtonContent}>
              <Feather name="settings" size={24} color={'#fff'} />
              <Text style={[styles.iconButtonText, { color: '#fff' }]}>Settings</Text>
            </View>
          </Pressable>
        </View>
        <FlatList
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 0 }}
          data={timestamps}
          keyExtractor={(item) => item.id} // Use item.id as keyExtractor
          renderItem={renderItem}
        />
        <View style={styles.bottomButtons}>
          {/* Large Add Timestamp Button */}
          <Pressable onPress={addTimestamp} style={({ pressed }) => [styles.largeButton, pressed && styles.largeButtonPressed]}>
            <View style={styles.largeButtonContent}>
              <Feather name="plus-circle" size={30} color={'#fff'} />
              <Text style={[styles.largeButtonText, { color: '#fff' }]}>Add Timestamp</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Info Modal (unchanged) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isInfoModalVisible}
        onRequestClose={() => {
          setIsInfoModalVisible(!isInfoModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>About This App</Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              This is a very simple launch and one-touch-add timestamp recorder app with no text
              associated with the timestamp. It automatically creates a timestamp when the app is launched.
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>Add TS buttons:</Text> Adds current date & time as a timestamp
              and shows the interval from last timestamp.
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>Export button:</Text> Exports timestamps data as .csv.
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>Clear All button:</Text> Clears all timestamps.
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>App author:</Text> Ravi S. Iyer with assistance from ChatGPT and Gemini
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>App date:</Text> 12 Jun. 2025
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ color: isDark ? '#87CEEB' : 'blue', textDecorationLine: 'underline' }} onPress={openBlogLink}>
                Using ChatGPT and Gemini to write React Native and Expo Timestamp app (web and mobile)
              </Text>
            </Text>
            <Button
              title="Dismiss"
              onPress={() => setIsInfoModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Foreground Prompt Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isForegroundPromptVisible}
        onRequestClose={handleDoNotAddTimestampFromPrompt}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000', marginBottom: 20 }]}>
              Add timestamp (Brought into foreground)?
            </Text>
            <View style={styles.modalButtonRow}>
              <Button title="Yes" onPress={handleAddTimestampFromPrompt} />
              <Button title="No" onPress={handleDoNotAddTimestampFromPrompt} color="red" />
            </View>
            <Text style={[styles.modalText, { color: isDark ? '#aaa' : '#666', fontSize: 14, marginTop: 10 }]}>
              (Auto-dismisses in 5 seconds)
            </Text>
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
              <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333', marginBottom: 15 }]}>
                Timestamp: {formattedTimestamp(timestamps[editingTimestampIndex]?.time || '')}
              </Text>
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
              numberOfLines={4}
              value={currentNoteText}
              onChangeText={setCurrentNoteText}
            />
            <View style={styles.modalButtonRow}>
              <Button title="Save Note" onPress={saveNote} />
              <Button title="Delete TS" onPress={deleteTimestamp} color="red" />
              <Button title="Cancel" onPress={() => setIsNoteModalVisible(false)} />
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
      padding: 20,
      paddingTop: 10,
      paddingBottom: isExpoGo ? 50 : 10,
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
      marginVertical: 10,
      flexWrap: 'wrap',
      gap: 5,
    },
    iconButton: {
      backgroundColor: '#007bff', // Consistent blue
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 5,
      flex: 1,
      minWidth: 65,
      maxWidth: 80,
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
    // New style for the highlight animation
    highlightedItem: {
      backgroundColor: Platform.OS === 'web' ? 'rgba(0, 123, 255, 0.4)' : 'rgba(0, 123, 255, 0.2)', // A temporary light blue flash
      borderWidth: 2,
      borderColor: '#007bff',
    },
    itemContentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemTextContent: {
      flex: 1,
      marginRight: 10,
    },
    pencilIcon: {
      // No specific styling needed here unless you want to override default size/color from component props
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
    },
    largeButton: {
      backgroundColor: '#007bff', // Consistent blue
      borderRadius: 10,
      paddingVertical: 15,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
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
      fontSize: 18,
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
      alignItems: 'center',
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
      width: '100%',
    },
    modalButtonRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: 15,
      gap: 10,
    },
    noteInput: {
      width: '100%',
      minHeight: 80,
      maxHeight: 150,
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginBottom: 20,
      textAlignVertical: 'top',
    },
  });
