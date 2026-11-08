
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type SessionExercise = {
  id: string;
  name_snapshot: string;
  position: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
};

type SetLog = {
  id: string;
  session_exercise_id: string;
  set_number: number;
  actual_reps: number | null;
  weight_kg: number | null;
  completed_at: string | null;
};

type Draft = {
  reps: string;
  weight: string;
};

type Props = {
  sessionId: string;
  workoutTitle: string;
  onDone: () => void;
};

export default function WorkoutSession({
  sessionId,
  workoutTitle,
  onDone,
}: Props) {
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [sets, setSets] = useState<SetLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const { data: exerciseData, error: exerciseError } =
          await supabase
            .from('session_exercises')
            .select(
              'id, name_snapshot, position, target_reps_min, target_reps_max'
            )
            .eq('session_id', sessionId)
            .order('position', { ascending: true });

        if (exerciseError) throw exerciseError;

        const items = (exerciseData ?? []) as SessionExercise[];
        const ids = items.map((item) => item.id);

        let logs: SetLog[] = [];

        if (ids.length > 0) {
          const { data, error } = await supabase
            .from('set_logs')
            .select(
              'id, session_exercise_id, set_number, actual_reps, weight_kg, completed_at'
            )
            .in('session_exercise_id', ids)
            .order('set_number', { ascending: true });

          if (error) throw error;
          logs = (data ?? []) as SetLog[];
        }

        if (!active) return;

        setExercises(items);
        setSets(logs);

        const initialDrafts: Record<string, Draft> = {};

        logs.forEach((log) => {
          initialDrafts[log.id] = {
            reps: log.actual_reps?.toString() ?? '',
            weight: log.weight_kg?.toString() ?? '',
          };
        });

        setDrafts(initialDrafts);
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'Loading failed'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [sessionId]);

  function updateDraft(
    setId: string,
    field: keyof Draft,
    value: string
  ) {
    setDrafts((previous) => ({
      ...previous,
      [setId]: {
        ...(previous[setId] ?? { reps: '', weight: '' }),
        [field]: value,
      },
    }));
  }

  async function saveSet(log: SetLog) {
    if (savingId || finishing) return;

    const draft = drafts[log.id];
    const repsText = draft?.reps.trim() ?? '';
    const weightText = (draft?.weight.trim() ?? '').replace(',', '.');

    if (!/^\d+$/.test(repsText)) {
      Alert.alert('Invalid reps', 'Enter a whole number of reps.');
      return;
    }

    const reps = Number(repsText);

    if (!Number.isSafeInteger(reps)) {
      Alert.alert('Invalid reps', 'Enter a valid number.');
      return;
    }

    if (weightText && !/^\d+(\.\d{1,2})?$/.test(weightText)) {
      Alert.alert('Invalid weight', 'Enter a weight with up to 2 decimals.');
      return;
    }

    const weight = weightText === '' ? null : Number(weightText);

    if (weight !== null && (!Number.isFinite(weight) || weight > 999999.99)) {
      Alert.alert('Invalid weight', 'Enter a valid weight in kg.');
      return;
    }

    setSavingId(log.id);

    try {
      const { data, error } = await supabase
        .from('set_logs')
        .update({
          actual_reps: reps,
          weight_kg: weight,
          completed_at: new Date().toISOString(),
        })
        .eq('id', log.id)
        .select(
          'id, session_exercise_id, set_number, actual_reps, weight_kg, completed_at'
        )
        .single();

      if (error) throw error;

      setSets((previous) =>
        previous.map((item) =>
          item.id === log.id ? (data as SetLog) : item
        )
      );
    } catch (error) {
      Alert.alert(
        'Could not save set',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSavingId(null);
    }
  }

  async function finishWorkout() {
    if (savingId || finishing) return;
    setFinishing(true);

    try {
      const { error } = await supabase
        .from('workout_sessions')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('status', 'in_progress')
        .select('id')
        .single();

      if (error) throw error;

      Alert.alert('Workout complete!', 'Your workout has been saved.');
      onDone();
    } catch (error) {
      Alert.alert(
        'Could not finish workout',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setFinishing(false);
    }
  }

  function confirmFinish() {
    const incomplete = sets.filter((s) => !s.completed_at).length;

    Alert.alert(
      'Finish workout?',
      incomplete > 0
        ? `You have ${incomplete} unfinished sets. Finish anyway?`
        : 'All your sets have been recorded!',
      [
        { text: 'Keep training', style: 'cancel' },
        { text: 'Finish', onPress: () => void finishWorkout() },
      ]
    );
  }

  const completed = sets.filter((s) => !!s.completed_at).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7EE2AC" size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError}</Text>
        <TouchableOpacity onPress={onDone}>
          <Text style={styles.back}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={onDone}>
          <Text style={styles.back}>← Back (session saved)</Text>
        </TouchableOpacity>

        <Text style={styles.caption}>WORKOUT IN PROGRESS</Text>
        <Text style={styles.title}>{workoutTitle}</Text>
        <Text style={styles.progress}>
          {completed} of {sets.length} sets completed
        </Text>

        {exercises.map((exercise) => {
          const exerciseSets = sets.filter(
            (log) => log.session_exercise_id === exercise.id
          );

          return (
            <View key={exercise.id} style={styles.card}>
              <Text style={styles.exerciseName}>
                {exercise.name_snapshot}
              </Text>

              <Text style={styles.hint}>
                Target: {exercise.target_reps_min ?? '—'}
                {exercise.target_reps_max != null &&
                exercise.target_reps_max !== exercise.target_reps_min
                  ? `–${exercise.target_reps_max}`
                  : ''} reps
              </Text>

              {exerciseSets.map((log) => (
                <View key={log.id} style={styles.setCard}>
                  <Text style={styles.setTitle}>
                    Set {log.set_number}
                    {log.completed_at ? '  ✓' : ''}
                  </Text>

                  <View style={styles.row}>
                    <View style={styles.field}>
                      <Text style={styles.label}>Reps</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="number-pad"
                        placeholder="10"
                        placeholderTextColor="#8591A3"
                        value={drafts[log.id]?.reps ?? ''}
                        onChangeText={(value) =>
                          updateDraft(log.id, 'reps', value)
                        }
                      />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Weight (kg)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        placeholder="40"
                        placeholderTextColor="#8591A3"
                        value={drafts[log.id]?.weight ?? ''}
                        onChangeText={(value) =>
                          updateDraft(log.id, 'weight', value)
                        }
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.saveButton}
                    disabled={savingId !== null || finishing}
                    onPress={() => saveSet(log)}
                  >
                    <Text style={styles.saveText}>
                      {savingId === log.id
                        ? 'Saving...'
                        : log.completed_at
                          ? '✓ Saved — Update Set'
                          : '✓ Save Set'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.finishButton}
          onPress={confirmFinish}
          disabled={finishing || savingId !== null}
        >
          <Text style={styles.finishText}>
            {finishing ? 'Finishing...' : 'Finish Workout'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101827' },
  center: {
    flex: 1,
    backgroundColor: '#101827',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: { padding: 24, paddingTop: 30, paddingBottom: 70 },
  back: { color: '#7EE2AC', fontSize: 15, marginBottom: 25 },
  caption: { color: '#7EE2AC', fontSize: 12, fontWeight: 'bold' },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 8,
  },
  progress: { color: '#A8B3C7', marginTop: 10, marginBottom: 25 },
  card: {
    backgroundColor: '#1E293B',
    padding: 17,
    borderRadius: 15,
    marginBottom: 18,
  },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
  },
  hint: { color: '#A8B3C7', marginTop: 6, marginBottom: 15 },
  setCard: {
    borderTopWidth: 1,
    borderTopColor: '#344155',
    paddingTop: 15,
    paddingBottom: 10,
  },
  setTitle: {
    color: '#7EE2AC',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { color: '#A8B3C7', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#101827',
    color: '#FFFFFF',
    borderRadius: 9,
    padding: 13,
    fontSize: 16,
  },
  saveButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 9,
    backgroundColor: '#334155',
  },
  saveText: { color: '#7EE2AC', fontWeight: 'bold' },
  finishButton: {
    backgroundColor: '#7EE2AC',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishText: { color: '#101827', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#FFFFFF', marginBottom: 20 },
});
