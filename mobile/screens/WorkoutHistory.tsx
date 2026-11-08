
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type HistorySession = {
  id: string;
  title_snapshot: string;
  started_at: string;
  finished_at: string | null;
};

type HistoryExercise = {
  id: string;
  name_snapshot: string;
  position: number;
};

type HistorySet = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  actual_reps: number | null;
  weight_kg: number | null;
  completed_at: string | null;
};

type Props = {
  userId: string;
  onBack: () => void;
};

export default function WorkoutHistory({ 
    userId, 
    onBack 
}: Props) {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const [exercises, setExercises] = useState<HistoryExercise[]>([]);
  const [sets, setSets] = useState<HistorySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, title_snapshot, started_at, finished_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('History error', error.message);
    } else {
      setSessions(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function openSession(session: HistorySession) {
    setSelected(session);
    setExercises([]);
    setSets([]);
    setDetailsLoading(true);

    try {
      const { data: exerciseData, error: exerciseError } =
        await supabase
          .from('session_exercises')
          .select('id, name_snapshot, position')
          .eq('session_id', session.id)
          .order('position', { ascending: true });

      if (exerciseError) throw exerciseError;

      const items = (exerciseData ?? []) as HistoryExercise[];
      setExercises(items);

      const ids = items.map((item) => item.id);

      if (ids.length > 0) {
        const { data, error } = await supabase
          .from('set_logs')
          .select(
            'id, session_exercise_id, set_number, actual_reps, weight_kg, completed_at'
          )
          .in('session_exercise_id', ids)
          .order('set_number', { ascending: true });

        if (error) throw error;

        setSets((data ?? []) as HistorySet[]);
      }
    } catch (error) {
      Alert.alert(
        'Could not load session',
        error instanceof Error ? error.message : 'Unknown error'
      );
      setSelected(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (selected) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <TouchableOpacity onPress={() => setSelected(null)}>
          <Text style={styles.back}>← Workout History</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{selected.title_snapshot}</Text>
        <Text style={styles.muted}>
          {formatDate(selected.finished_at ?? selected.started_at)}
        </Text>

        {detailsLoading ? (
          <ActivityIndicator color="#7EE2AC" size="large" />
        ) : (
          exercises.map((exercise) => {
            const exerciseSets = sets.filter(
              (s) => s.session_exercise_id === exercise.id
            );

            return (
              <View key={exercise.id} style={styles.card}>
                <Text style={styles.exerciseTitle}>
                  {exercise.name_snapshot}
                </Text>

                {exerciseSets.map((log) => (
                  <View key={log.id} style={styles.setRow}>
                    <Text style={styles.muted}>
                      Set {log.set_number}
                    </Text>

                    <Text style={styles.setText}>
                      {log.completed_at
                        ? `${log.actual_reps ?? '—'} reps · ${
                            log.weight_kg === null
                              ? 'No weight recorded'
                              : `${log.weight_kg} kg`
                          }`
                        : 'Not completed'}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← My Workouts</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Workout History</Text>
        <Text style={styles.muted}>
          Your completed workout sessions
        </Text>

        {loading ? (
          <ActivityIndicator color="#7EE2AC" size="large" />
        ) : (
          <FlatList
            style={{ marginTop: 25 }}
            data={sessions}
            keyExtractor={(item) => item.id}
            onRefresh={loadHistory}
            refreshing={loading}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openSession(item)}
              >
                <Text style={styles.exerciseTitle}>
                  {item.title_snapshot} →
                </Text>
                <Text style={styles.muted}>
                  {formatDate(item.finished_at ?? item.started_at)}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.muted}>
                No completed workouts yet.
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 65,
  },
  back: {
    color: '#7EE2AC',
    fontSize: 15,
    marginBottom: 25,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  muted: {
    color: '#A8B3C7',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 14,
    marginBottom: 14,
  },
  exerciseTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#344155',
    gap: 12,
  },
  setText: {
    color: '#7EE2AC',
    fontSize: 14,
  },
});
