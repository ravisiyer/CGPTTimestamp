import { useEffect, useState } from 'react';
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
  Linking, // For opening URLs
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';

const STORAGE_KEY = '@timestamp_list';
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function App() {
  const [timestamps, setTimestamps] = useState([]);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false); 
  const isDark = useColorScheme() === 'dark';
  const styles = useStyles(isDark);

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        const now = new Date().toISOString();
        const updated = [now, ...parsed].slice(0, 100);
        setTimestamps(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Error loading timestamps:", error);
        Alert.alert("Error", "Something went wrong while loading timestamps.");
      }
    };
    loadData();
  }, []);

  const addTimestamp = async () => {
    const now = new Date().toISOString();
    const updated = [now, ...timestamps].slice(0, 100);
    setTimestamps(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

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
      alert('No timestamps to export.');
      return;
    }

    const header = `"Timestamp","Interval"\n`;
    const csvBody = timestamps
      .map((t, i) => {
        const next = timestamps[i + 1];
        // Pass the raw millisecond difference to formatInterval
        const interval = next
          ? formatInterval(new Date(t) - new Date(next)) // Removed / 1000
          : '';
        return `"${new Date(t).toLocaleString()}","${interval}"`;
      })
      .join('\n');

    const csv = header + csvBody;

    // ... rest of the exportTimestamps function remains the same
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

  // const exportTimestamps = async () => {
  //   if (timestamps.length === 0) {
  //     alert('No timestamps to export.');
  //     return;
  //   }

  //   const header = `"Timestamp","Interval"\n`;
  //   const csvBody = timestamps
  //     .map((t, i) => {
  //       const next = timestamps[i + 1];
  //       const interval = next
  //         ? formatInterval((new Date(t) - new Date(next)) / 1000)
  //         : '';
  //       return `"${new Date(t).toLocaleString()}","${interval}"`;
  //     })
  //     .join('\n');

  //   const csv = header + csvBody;

  //   if (Platform.OS === 'web') {
  //     const blob = new Blob([csv], { type: 'text/csv' });
  //     const url = URL.createObjectURL(blob);
  //     const anchor = document.createElement('a');
  //     anchor.href = url;
  //     anchor.download = 'timestamps.csv';
  //     anchor.click();
  //     URL.revokeObjectURL(url);
  //   } else {
  //     const fileUri = FileSystem.documentDirectory + 'timestamps.csv';
  //     await FileSystem.writeAsStringAsync(fileUri, csv);

  //     if (await Sharing.isAvailableAsync()) {
  //       await Sharing.shareAsync(fileUri);
  //     } else {
  //       alert('Sharing not available on this platform.');
  //     }
  //   }
  // };  

  const formatInterval = (totalMilliseconds) => {
    if (totalMilliseconds === null || isNaN(totalMilliseconds)) return '';

    // Calculate total seconds by flooring, not rounding, to correctly extract larger units
    const totalSeconds = Math.floor(totalMilliseconds / 1000);

    const days = Math.floor(totalSeconds / 86400);
    const hrs = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60; // This is now correct based on totalSeconds

    // Milliseconds are the remainder after extracting full seconds
    const millisecs = Math.round(totalMilliseconds % 1000);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hrs > 0 || days > 0) result += `${hrs}h `;
    if (mins > 0 || hrs > 0 || days > 0) result += `${mins}m `;
    result += `${secs}s `;
    result += `${millisecs}ms`;

    return result.trim();
  };

  // const formatInterval = (seconds) => {
  //   if (seconds === '') return '';
  //   const total = Math.round(seconds); // rounded total seconds
  //   const days = Math.floor(total / 86400);
  //   const hrs = Math.floor((total % 86400) / 3600);
  //   const mins = Math.floor((total % 3600) / 60);
  //   const secs = total % 60;

  //   let result = '';
  //   if (days > 0) result += `${days}d `;
  //   if (hrs > 0 || days > 0) result += `${hrs}h `;
  //   if (mins > 0 || hrs > 0 || days > 0) result += `${mins}m `;
  //   result += `${secs}s`;

  //   return result.trim();
  // };
  const renderItem = ({ item, index }) => {
    const current = new Date(item);
    const prev = timestamps[index + 1]
      ? new Date(timestamps[index + 1])
      : null;
    // Pass the raw millisecond difference to formatInterval
    const intervalMilliseconds = prev != null ? Math.abs(current - prev) : null; // Removed / 1000
    const interval = intervalMilliseconds != null ? formatInterval(intervalMilliseconds) : null;

    const isLastItem = index === timestamps.length - 1;

    return (
      <View style={[styles.item, isLastItem && { marginBottom: 0 }]}>
        <Text style={styles.text}>{current.toLocaleString()}</Text>
        {interval && <Text style={styles.text}>Interval: {interval}</Text>}
      </View>
    );
  };

  // const renderItem = ({ item, index }) => {
  //   const current = new Date(item);
  //   const prev = timestamps[index + 1]
  //     ? new Date(timestamps[index + 1])
  //     : null;
  //   const intervalSeconds = prev != null ? Math.abs((current - prev) / 1000) : null;
  //   const interval = intervalSeconds != null ? formatInterval(intervalSeconds) : null;

  //   const isLastItem = index === timestamps.length - 1;

  //   return (
  //     <View style={[styles.item, isLastItem && { marginBottom: 0 }]}>
  //       <Text style={styles.text}>{current.toLocaleString()}</Text>
  //       {interval && <Text style={styles.text}>Interval: {interval}</Text>}
  //     </View>
  //   );
  // };

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
              <Text style={{ fontWeight: 'bold' }}>App date:</Text> 10 Jun. 2025
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
