
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import WorkoutSession from './WorkoutSession';

type WorkoutExercise = {
  id: string;
  position: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  exercise: { name: string } | null;
};

type Props = {
  workoutId: string;
  workoutTitle: string;
  userId: string;
  onBack: () => void;
};

export default function WorkoutDetails({
  workoutId,
  workoutTitle,
  userId,
  onBack,
}: Props) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadExercises = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('workout_template_exercises')
      .select(`
        id,
        position,
        target_sets,
        target_reps_min,
        target_reps_max,
        exercise:exercises(name)
      `)
      .eq('workout_id', workoutId)
      .order('position', { ascending: true });

   
if (error) {
  Alert.alert('Loading error', error.message);
} else {
  const formattedExercises: WorkoutExercise[] = (data ?? []).map(
    (item) => ({
      id: item.id,
      position: item.position,
      target_sets: item.target_sets,
      target_reps_min: item.target_reps_min,
      target_reps_max: item.target_reps_max,
      exercise: Array.isArray(item.exercise)
        ? item.exercise[0] ?? null
        : item.exercise ?? null,
    })
  );

  setExercises(formattedExercises);
}


    setLoading(false);
  }, [workoutId]);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  async function addExercise() {
    const exerciseName = name.trim();
    const numberOfSets = Number(sets);
    const numberOfReps = Number(reps);

    if (!exerciseName) {
      Alert.alert('Missing name', 'Enter an exercise name.');
      return;
    }

    if (
      !Number.isInteger(numberOfSets) ||
      numberOfSets < 1 ||
      !Number.isInteger(numberOfReps) ||
      numberOfReps < 1
    ) {
      Alert.alert('Invalid values', 'Enter valid sets and reps.');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      // Create a private exercise belonging to the user.
      const { data: exercise, error: exerciseError } =
        await supabase
          .from('exercises')
          .insert({
            name: exerciseName,
            created_by: userId,
            is_public: false,
          })
          .select('id')
          .single();

      if (exerciseError) throw exerciseError;

      // Add this exercise to the selected workout.
      const nextPosition =
        Math.max(-1, ...exercises.map(e => e.position)) + 1;

      const { error: linkError } = await supabase
        .from('workout_template_exercises')
        .insert({
          workout_id: workoutId,
          exercise_id: exercise.id,
          position: nextPosition,
          target_sets: numberOfSets,
          target_reps_min: numberOfReps,
          target_reps_max: numberOfReps,
        });

      if (linkError) throw linkError;

      setName('');
      setSets('3');
      setReps('10');

      await loadExercises();
    } catch (error) {
      Alert.alert(
        'Could not add exercise',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSaving(false);
    }
  }


async function moveExercise(
  exerciseId: string,
  direction: 'up' | 'down'
) {
  if (moving) return;

  setMoving(exerciseId);

  try {
    const { error } = await supabase.rpc(
      'move_workout_exercise',
      {
        p_workout_id: workoutId,
        p_exercise_id: exerciseId,
        p_direction: direction,
      }
    );

    if (error) throw error;

    await loadExercises();
  } catch (error) {
    Alert.alert(
      'Could not move exercise',
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    setMoving(null);
  }
}


async function startWorkout() {
  if (starting) return;
  setStarting(true);

  try {
    // Resume an unfinished workout if one exists.
    const { data: existing, error: lookupError } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('template_id', workoutId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing) {
      setActiveSessionId(existing.id);
      return;
    }

    // Otherwise start a new workout.
    const { data, error } = await supabase.rpc('start_workout', {
      p_workout_id: workoutId,
    });

    if (error) throw error;
    if (typeof data !== 'string') {
      throw new Error('No session ID returned');
    }

    setActiveSessionId(data);
  } catch (error) {
    Alert.alert(
      'Could not start workout',
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    setStarting(false);
  }
}

if (activeSessionId) {
  return (
    <WorkoutSession
      sessionId={activeSessionId}
      workoutTitle={workoutTitle}
      onDone={() => setActiveSessionId(null)}
    />
  );
}



  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← My Workouts</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{workoutTitle}</Text>
        <Text style={styles.subtitle}>
          {exercises.length} exercises
        </Text>

        <Text style={styles.heading}>Exercises</Text>

        {loading ? (
          <ActivityIndicator color="#7EE2AC" />
        ) : exercises.length === 0 ? (
          <Text style={styles.muted}>
            No exercises yet. Add your first one below.
          </Text>
        ) : (
          
        exercises.map((item, index) => (
        <View key={item.id} style={styles.card}>
            <Text style={styles.number}>{index + 1}</Text>

            <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>
                {item.exercise?.name ?? 'Unknown exercise'}
            </Text>

            <Text style={styles.muted}>
                {item.target_sets} sets × {item.target_reps_min} reps
            </Text>
            </View>

            <View style={styles.orderButtons}>
            <TouchableOpacity
                disabled={index === 0 || moving !== null}
                onPress={() => moveExercise(item.id, 'up')}
            >
                <Text
                style={[
                    styles.arrow,
                    index === 0 && styles.disabledArrow,
                ]}
                >
                ▲
                </Text>
            </TouchableOpacity>

            
            <TouchableOpacity
                disabled={
                index === exercises.length - 1 || moving !== null
                }
                onPress={() => moveExercise(item.id, 'down')}
            >
                <Text
                style={[
                    styles.arrow,
                    index === exercises.length - 1 &&
                    styles.disabledArrow,
                ]}
                >
                ▼
                </Text>
            </TouchableOpacity>
            </View>
        </View>
        ))

        )}

        <TouchableOpacity
            style={styles.startButton}
            onPress={startWorkout}
            disabled={starting || loading}
            >
            <Text style={styles.startButtonText}>
                {starting ? 'Starting...' : '▶ Start / Resume Workout'}
            </Text>
            </TouchableOpacity>

        <View style={styles.form}>
          <Text style={styles.heading}>Add an exercise</Text>

          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            placeholderTextColor="#8591A3"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Sets</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={sets}
                onChangeText={setSets}
              />
            </View>

            <View style={styles.half}>
              <Text style={styles.label}>Reps</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && { opacity: 0.6 }]}
            onPress={addExercise}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Saving...' : '+ Add Exercise'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 24, paddingTop: 65, paddingBottom: 60 },
  back: { color: '#7EE2AC', fontSize: 15, marginBottom: 25 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: 'bold' },
  subtitle: { color: '#A8B3C7', marginTop: 8, marginBottom: 30 },
  heading: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#1E293B',
    padding: 17,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  number: { color: '#7EE2AC', fontSize: 18, fontWeight: 'bold' },
  exerciseName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  muted: { color: '#A8B3C7', fontSize: 14 },
  form: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    marginTop: 25,
  },
  input: {
    backgroundColor: '#101827',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { color: '#A8B3C7', marginBottom: 8 },
  button: {
    backgroundColor: '#7EE2AC',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#101827', fontWeight: 'bold' },

  orderButtons: {
  gap: 14,
  alignItems: 'center',
  paddingHorizontal: 5,
},
arrow: {
  color: '#7EE2AC',
  fontSize: 19,
  fontWeight: 'bold',
},
disabledArrow: {
  opacity: 0.2,
},
startButton: {
  backgroundColor: '#7EE2AC',
  padding: 18,
  borderRadius: 12,
  alignItems: 'center',
  marginTop: 20,
  marginBottom: 20,
},
startButtonText: {
  color: '#101827',
  fontSize: 16,
  fontWeight: 'bold',
},
});
