
import React, { useState } from 'react';
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

type ExtractedExercise = {
  name: string;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  notes: string | null;
};

type EditableExercise = {
  name: string;
  sets: string;
  reps_min: string;
  reps_max: string;
  rest_seconds: string;
  notes: string;
};

type Draft = {
  title: string;
  exercises: EditableExercise[];
  warnings: string[];
};

type Props = {
  onBack: () => void;
  onSaved: () => void;
};

function optionalNumber(
  value: string,
  label: string,
  min: number,
  max: number
): number | null {
  const text = value.trim();

  if (!text) return null;

  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a whole number.`);
  }

  const number = Number(text);

  if (!Number.isSafeInteger(number) ||
      number < min ||
      number > max) {
    throw new Error(
      `${label} must be between ${min} and ${max}.`
    );
  }

  return number;
}

export default function ImportWorkout({
  onBack,
  onSaved,
}: Props) {
  const [caption, setCaption] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  async function extractWorkout() {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;

    if (!apiUrl) {
      Alert.alert('Configuration error', 'FastAPI URL is missing.');
      return;
    }

    if (caption.trim().length < 10) {
      Alert.alert('Missing caption', 'Enter a workout description.');
      return;
    }

    setExtracting(true);
    setDraft(null);

    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, '')}/imports/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: caption.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!Array.isArray(result.exercises)) {
        throw new Error('Invalid workout response.');
      }

      const exercises: EditableExercise[] =
        (result.exercises as ExtractedExercise[]).map(
          (exercise) => ({
            name: exercise.name ?? '',
            sets: exercise.sets?.toString() ?? '',
            reps_min: exercise.reps_min?.toString() ?? '',
            reps_max: exercise.reps_max?.toString() ?? '',
            rest_seconds:
              exercise.rest_seconds?.toString() ?? '',
            notes: exercise.notes ?? '',
          })
        );

      setDraft({
        title: result.title || 'Imported Workout',
        exercises,
        warnings: Array.isArray(result.warnings)
          ? result.warnings
          : [],
      });
    } catch (error) {
      Alert.alert(
        'Extraction failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setExtracting(false);
    }
  }

  function updateExercise(
    index: number,
    field: keyof EditableExercise,
    value: string
  ) {
    setDraft((previous) => {
      if (!previous) return previous;

      const exercises = [...previous.exercises];
      exercises[index] = {
        ...exercises[index],
        [field]: value,
      };

      return { ...previous, exercises };
    });
  }

  function removeExercise(index: number) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            exercises: previous.exercises.filter(
              (_, i) => i !== index
            ),
          }
        : previous
    );
  }

  function addExercise() {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            exercises: [
              ...previous.exercises,
              {
                name: '',
                sets: '',
                reps_min: '',
                reps_max: '',
                rest_seconds: '',
                notes: '',
              },
            ],
          }
        : previous
    );
  }

  async function saveWorkout() {
    if (!draft || saving) return;

    if (!draft.title.trim() ||
        draft.title.trim().length > 100) {
      Alert.alert('Invalid title', 'Enter a valid workout title.');
      return;
    }

    if (draft.exercises.length < 1 ||
        draft.exercises.length > 30) {
      Alert.alert('Invalid workout', 'Include 1 to 30 exercises.');
      return;
    }

    setSaving(true);

    try {
      const exercises = draft.exercises.map((exercise) => {
        const name = exercise.name.trim();
        const notes = exercise.notes.trim();

        if (!name || name.length > 100) {
          throw new Error('Every exercise needs a valid name.');
        }

        if (notes.length > 500) {
          throw new Error('Exercise notes are too long.');
        }

        const repsMin = optionalNumber(
          exercise.reps_min, 'Minimum reps', 1, 300
        );

        const repsMax = optionalNumber(
          exercise.reps_max, 'Maximum reps', 1, 300
        );

        if (repsMin !== null &&
            repsMax !== null &&
            repsMax < repsMin) {
          throw new Error(
            'Maximum reps cannot be lower than minimum reps.'
          );
        }

        return {
          name,
          sets: optionalNumber(exercise.sets, 'Sets', 1, 20),
          reps_min: repsMin,
          reps_max: repsMax,
          rest_seconds: optionalNumber(
            exercise.rest_seconds, 'Rest seconds', 0, 3600
          ),
          notes: notes || null,
        };
      });

      const { data, error } = await supabase.rpc(
        'save_imported_workout',
        {
          p_title: draft.title.trim(),
          p_exercises: exercises,
        }
      );

      if (error) throw error;
      if (!data) throw new Error('No workout ID returned.');

      Alert.alert('Saved!', 'Workout added to your library.');
      onSaved();
    } catch (error) {
      Alert.alert(
        'Could not save workout',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← My Workouts</Text>
      </TouchableOpacity>

      <Text style={styles.captionLabel}>WORKOUT IMPORTER</Text>
      <Text style={styles.title}>Import a Workout</Text>
      <Text style={styles.muted}>
        Paste a workout caption and turn it into a routine.
      </Text>

      <View style={styles.card}>
        <Text style={styles.heading}>Workout description</Text>

        <TextInput
          style={[styles.input, styles.captionInput]}
          placeholder="Squats 3x10, Hip Thrusts 4x12..."
          placeholderTextColor="#8591A3"
          multiline
          textAlignVertical="top"
          value={caption}
          onChangeText={setCaption}
          maxLength={8000}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={extractWorkout}
          disabled={extracting || saving}
        >
          {extracting ? (
            <ActivityIndicator color="#101827" />
          ) : (
            <Text style={styles.buttonText}>
              ✨ Extract Workout
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {draft && (
        <View style={styles.card}>
          <Text style={styles.heading}>Review Workout</Text>

          <Text style={styles.label}>Workout name</Text>
          <TextInput
            style={styles.input}
            value={draft.title}
            maxLength={100}
            onChangeText={(value) =>
              setDraft((old) =>
                old ? { ...old, title: value } : old
              )
            }
          />

          {draft.warnings.map((warning, index) => (
            <Text key={index} style={styles.warning}>
              ⚠ {warning}
            </Text>
          ))}

          {draft.exercises.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <Text style={styles.exerciseTitle}>
                Exercise {index + 1}
              </Text>

              <Text style={styles.label}>Exercise name</Text>
              <TextInput
                style={styles.input}
                value={exercise.name}
                onChangeText={(value) =>
                  updateExercise(index, 'name', value)
                }
              />

              <View style={styles.row}>
                {([
                  ['Sets', 'sets'],
                  ['Min reps', 'reps_min'],
                  ['Max reps', 'reps_max'],
                ] as const).map(([label, field]) => (
                  <View key={field} style={styles.column}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      value={exercise[field]}
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        updateExercise(index, field, value)
                      }
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.label}>Rest (seconds)</Text>
              <TextInput
                style={styles.input}
                value={exercise.rest_seconds}
                keyboardType="number-pad"
                onChangeText={(value) =>
                  updateExercise(index, 'rest_seconds', value)
                }
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.input}
                value={exercise.notes}
                maxLength={500}
                onChangeText={(value) =>
                  updateExercise(index, 'notes', value)
                }
              />

              <TouchableOpacity
                onPress={() => removeExercise(index)}
              >
                <Text style={styles.remove}>Remove exercise</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={addExercise}
            disabled={draft.exercises.length >= 30}
          >
            <Text style={styles.secondaryText}>
              + Add missed exercise
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={saveWorkout}
            disabled={saving || draft.exercises.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#101827" />
            ) : (
              <Text style={styles.buttonText}>
                Save to My Workouts
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 24, paddingTop: 65, paddingBottom: 80 },
  back: { color: '#7EE2AC', marginBottom: 25 },
  captionLabel: {
    color: '#7EE2AC', fontWeight: 'bold', fontSize: 12,
  },
  title: {
    color: '#FFFFFF', fontSize: 30,
    fontWeight: 'bold', marginTop: 8,
  },
  muted: { color: '#A8B3C7', marginTop: 12, marginBottom: 22 },
  card: {
    backgroundColor: '#1E293B', padding: 18,
    borderRadius: 16, marginBottom: 20,
  },
  heading: {
    color: '#FFFFFF', fontSize: 19,
    fontWeight: 'bold', marginBottom: 16,
  },
  label: {
    color: '#A8B3C7', fontSize: 12, marginBottom: 6,
  },
  input: {
    backgroundColor: '#101827', color: '#FFFFFF',
    padding: 13, borderRadius: 10,
    marginBottom: 15, fontSize: 15,
  },
  captionInput: { minHeight: 145 },
  button: {
    backgroundColor: '#7EE2AC', padding: 17,
    alignItems: 'center', borderRadius: 11, marginTop: 8,
  },
  buttonText: {
    color: '#101827', fontSize: 16, fontWeight: 'bold',
  },
  exerciseCard: {
    backgroundColor: '#283548', padding: 15,
    borderRadius: 12, marginBottom: 15,
  },
  exerciseTitle: {
    color: '#FFFFFF', fontSize: 17,
    fontWeight: 'bold', marginBottom: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  column: { flex: 1 },
  remove: { color: '#FF9999', marginBottom: 8 },
  warning: { color: '#FBCB79', marginBottom: 12 },
  secondaryButton: {
    padding: 15, borderRadius: 10,
    borderWidth: 1, borderColor: '#7EE2AC',
    alignItems: 'center', marginBottom: 12,
  },
  secondaryText: { color: '#7EE2AC', fontWeight: 'bold' },
});
