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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@timestamp_list';

export default function App() {
  const [timestamps, setTimestamps] = useState([]);

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

  const clearTimestamps = () => {
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
  };

  const renderItem = ({ item, index }) => {
    const current = new Date(item);
    const prev = timestamps[index + 1]
      ? new Date(timestamps[index + 1])
      : null;
    const interval =
      prev != null ? `${Math.abs((current - prev) / 1000)} sec` : null;

    return (
      <View style={styles.item}>
        <Text>{current.toLocaleString()}</Text>
        {interval && <Text>Interval: {interval}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Timestamp Tracker</Text>
      <Button title="Add Timestamp" onPress={addTimestamp} />
      <FlatList
        data={timestamps}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
      />
      <Button color="red" title="Clear All" onPress={clearTimestamps} />
      <Text style={styles.footer}>Running on: {Platform.OS}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, marginTop: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  item: {
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  footer: {
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    color: '#666',
  },
});
