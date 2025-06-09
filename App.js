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
      const interval = next
        ? formatInterval((new Date(t) - new Date(next)) / 1000)
        : '';
      return `"${new Date(t).toLocaleString()}","${interval}"`;
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

const formatInterval = (seconds) => {
  if (seconds === '') return '';
  const total = Math.round(seconds); // rounded total seconds
  const days = Math.floor(total / 86400);
  const hrs = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hrs > 0 || days > 0) result += `${hrs}h `;
  if (mins > 0 || hrs > 0 || days > 0) result += `${mins}m `;
  result += `${secs}s`;

  return result.trim();
};

const renderItem = ({ item, index }) => {
  const current = new Date(item);
  const prev = timestamps[index + 1]
    ? new Date(timestamps[index + 1])
    : null;
  const intervalSeconds = prev != null ? Math.abs((current - prev) / 1000) : null;
  const interval = intervalSeconds != null ? formatInterval(intervalSeconds) : null;

  const isLastItem = index === timestamps.length - 1;

  return (
    <View style={[styles.item, isLastItem && { marginBottom: 0 }]}>
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
        backgroundColor={isDark ? '#000000' : '#ffffff'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <View style={styles.inner}>
        <Text style={styles.title}>Timestamp Tracker</Text>
        <Button title="Export to File" onPress={exportTimestamps} />
        <Button color="red" title="Clear All" onPress={clearTimestamps} />
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
    </SafeAreaView>
  );
}

const useStyles = (isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20, // Strangely padding has no impact on web but has on Android
      paddingTop: 10,     // paddingTop and paddingBottom have impact both on web and Android
      paddingBottom: 10,
      // marginTop: 30,
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
      marginBottom: 20,
      color: isDark ? '#fff' : '#000',
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
      // marginVertical: 10,
      gap: 10, // You can use padding/margin if `gap` is unsupported
    },
  });
