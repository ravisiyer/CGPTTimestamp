import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const STORAGE_KEY = '@timestamp_list';

export default function App() {
  const [timestamps, setTimestamps] = useState([]);
  const isDark = useColorScheme() === 'dark';
  const styles = useStyles(isDark);

  useEffect(() => {
    const loadData = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const now = new Date().toISOString();
      const updated = [now, ...parsed].slice(0, 100);
      setTimestamps(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

  const csv = timestamps
    .map((t, i) => {
      const next = timestamps[i + 1];
      const interval = next ? (new Date(t) - new Date(next)) / 1000 : '';
      return `"${new Date(t).toLocaleString()}","${interval}"`;
    })
    .join('\n');

  if (Platform.OS === 'web') {
    // Create a Blob and trigger download in browser
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'timestamps.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  } else {
    // Native (Android, iOS)
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

  //   const csv = timestamps
  //     .map((t, i) => {
  //       const next = timestamps[i + 1];
  //       const interval = next ? (new Date(t) - new Date(next)) / 1000 : '';
  //       return `"${new Date(t).toLocaleString()}","${interval}"`;
  //     })
  //     .join('\n');

  //   const fileUri = FileSystem.documentDirectory + 'timestamps.csv';
  //   await FileSystem.writeAsStringAsync(fileUri, csv);

  //   if (await Sharing.isAvailableAsync()) {
  //     await Sharing.shareAsync(fileUri);
  //   } else {
  //     alert('Sharing not available on this platform.');
  //   }
  // };

  const renderItem = ({ item, index }) => {
    const current = new Date(item);
    const prev = timestamps[index + 1]
      ? new Date(timestamps[index + 1])
      : null;
    const interval =
      prev != null ? `${Math.abs((current - prev) / 1000)} sec` : null;

    return (
      <View style={styles.item}>
        <Text style={styles.text}>{current.toLocaleString()}</Text>
        {interval && <Text style={styles.text}>Interval: {interval}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      Platform.OS === 'android' && { paddingTop: StatusBar.currentHeight || 0 }
    ]}>
      <StatusBar
        translucent
        // backgroundColor="transparent"
        backgroundColor={isDark ? '#000000' : '#ffffff'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <Text style={styles.title}>Timestamp Tracker</Text>
      <Button title="Add Timestamp" onPress={addTimestamp} />
      <FlatList
        data={timestamps}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
      />
      <Button title="Export to File" onPress={exportTimestamps} />
      <Button color="red" title="Clear All" onPress={clearTimestamps} />
      <Text style={styles.footer}>Running on: {Platform.OS}</Text>
    </SafeAreaView>
  );
}

const useStyles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      marginTop: 30,
      backgroundColor: isDark ? '#000' : '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: isDark ? '#fff' : '#000',
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
    footer: {
      textAlign: 'center',
      marginTop: 20,
      fontStyle: 'italic',
      color: isDark ? '#ccc' : '#666',
    },
  });
