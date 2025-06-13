import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { formatInterval } from './util.mjs';
import * as Localization from 'expo-localization';

const STORAGE_KEY = '@timestamp_list';
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function App() {
  const [timestamps, setTimestamps] = useState([]);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false); 
  const isDark = useColorScheme() === 'dark';
  const styles = useStyles(isDark);
  const appState = useRef(AppState.currentState);

  // Modified addTimestamp to use functional update for setTimestamps
  const addTimestamp = async () => {
    const now = new Date().toISOString();
    // Using the functional update form of setTimestamps ensures
    // that `prevTimestamps` always has the most up-to-date state.
    setTimestamps(prevTimestamps => {
      const updated = [now, ...prevTimestamps].slice(0, 100);
      // It's good practice to save to AsyncStorage immediately after
      // the state has been calculated and before returning it.
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(error => {
        console.error("Error saving timestamp to storage:", error);
      });
      console.log(`Timestamp added: ${now}`);
      return updated;
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        
        // The original code was adding a timestamp here on every load.
        // This implicitly handles the "app not open, timestamp gets created on open" part.
        // If 'parsed' contains existing timestamps, this will prepend the new one
        // without clearing them, unless the list length exceeds 100 and it truncates.
        const nowOnLoad = new Date().toISOString();
        const updatedOnLoad = [nowOnLoad, ...parsed].slice(0, 100);
        setTimestamps(updatedOnLoad);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOnLoad));
        console.log("Timestamps loaded and initial timestamp added/updated:", updatedOnLoad.length);

      } catch (error) {
        console.error("Error loading timestamps:", error);
        Alert.alert("Error", "Something went wrong while loading timestamps.");
      }
    };

    // Set up the AppState change listener
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      // Check if the app was in the background/inactive and is now active (came to foreground)
      // This specifically handles the case where the app was already open but not in view.
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground!');
        // Call addTimestamp, which will now use the latest state due to functional update
        addTimestamp(); 
      }
      // Always update the current app state reference for the next comparison
      appState.current = nextAppState;
    });

    loadData(); // Call loadData on component mount to load existing and add initial timestamp

    // Cleanup function for the useEffect hook.
    // This runs when the component unmounts.
    return () => {
      // Remove the AppState event listener to prevent memory leaks.
      appStateSubscription.remove();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

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

  const formattedTimestamp = (date) => {
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
      alert('No timestamps to export.');
      return;
    }

    const header = `"Timestamp","Interval"\n`;
    const csvBody = timestamps
      .map((t, i) => {
        const next = timestamps[i + 1];
        const interval = next
          ? formatInterval(new Date(t) - new Date(next))
          : '';
        return `"${formattedTimestamp(new Date(t))}","${interval}"`;
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
        alert('Sharing not available on this platform.');
      }
    }
  };

  const renderItem = ({ item, index }) => {
    const current = new Date(item);
    const prev = timestamps[index + 1]
      ? new Date(timestamps[index + 1])
      : null;

    const formattedTimestampWithMs = formattedTimestamp(current);

    const intervalMilliseconds = prev != null ? Math.abs(current - prev) : null;
    const interval = intervalMilliseconds != null ? formatInterval(intervalMilliseconds) : null;

    const isLastItem = index === timestamps.length - 1;

    return (
      <View style={[styles.item, isLastItem && { marginBottom: 0 }]}>
        <Text style={styles.text}>{formattedTimestampWithMs}</Text>
        {interval && <Text style={styles.text}>Interval: {interval}</Text>}
      </View>
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
          <Button title="Add TS" onPress={addTimestamp} />
          <Button title="Export" onPress={exportTimestamps} />
          <Button color="red" title="Clear" onPress={clearTimestamps} />
          <Button title="Info" onPress={() => setIsInfoModalVisible(true)} /> 
        </View>
        <FlatList
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 0 }}
          data={timestamps}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
        />
        <View style={styles.bottomButtons}>
          <Button title="Add Timestamp" onPress={addTimestamp} />
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
          <View style={[styles.modalView, { backgroundColor: isDark ? '#333' : '#f9f9f9' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>About This App</Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              This is a very simple launch and one-touch-add timestamp recorder app with no text 
              associated with the timestamp. It automatically creates a timestamp when the app is launched.
            </Text>
            <Text style={[styles.modalText, { color: isDark ? '#ddd' : '#333' }]}>
              <Text style={{ fontWeight: 'bold' }}>Add buttons:</Text> Adds current date & time as a timestamp 
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
              <Text style={{ fontWeight: 'bold' }}>App blog post:</Text>{' '}
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
    </SafeAreaView>
  );
}

const useStyles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20, // Strangely padding has no impact on web but has on Android
      paddingTop: 10,     // paddingTop and paddingBottom have impact both on web and Android
      paddingBottom: isExpoGo ? 50 : 10, // Extra padding only in Expo Go as otherwise it sometimes
                          // shows button behind Android's bottom navigation; No issue for production
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
      // marginBottom: 10,
      color: isDark ? '#fff' : '#000',
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 10,
    },
    list: {
      flex: 1,
      marginVertical: 10,
    },
    item: {
      padding: 10,
      marginBottom: 8,
      backgroundColor: isDark ? '#222' : '#eee',
      borderRadius: 8,
    },
    text: {
      color: isDark ? '#fff' : '#000',
    },
    bottomButtons: {
      gap: 10, 
    },
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)', // Dim background when modal is open
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
      width: '90%', // Adjust width as needed
      maxWidth: 600, // Max width for larger screens
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
      textAlign: 'left', // Align text to the left for readability
      width: '100%', // Ensure text takes full width
    },
  });
