
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import WorkoutDetails from './WorkoutDetails';
import WorkoutHistory from './WorkoutHistory';
import WorkoutPlanner from './WorkoutPlanner';
import ProgressScreen from './ProgressScreen';
import ImportWorkout from './ImportWorkout';

type Workout = {
  id: string;
  title: string;
  created_at: string;
};

type Props = {
  userId: string;
  onSignOut: () => void;
};

export default function WorkoutHome({
  userId,
  onSignOut,
}: Props) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWorkout, setSelectedWorkout] =
  useState<Workout | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('workout_templates')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error loading workouts', error.message);
    } else {
      setWorkouts(data ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  async function createWorkout() {
    const name = title.trim();

    if (!name) {
      Alert.alert('Missing name', 'Enter a workout name.');
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          user_id: userId,
          title: name,
          source_type: 'manual',
        })
        .select('id, title, created_at')
        .single();

      if (error) throw error;

      setWorkouts((previous) => [data, ...previous]);
      setTitle('');
    } catch (error) {
      Alert.alert(
        'Could not save workout',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setSaving(false);
    }
  }

  if (selectedWorkout) {
  return (
    <WorkoutDetails
      workoutId={selectedWorkout.id}
      workoutTitle={selectedWorkout.title}
      userId={userId}
      onBack={() => setSelectedWorkout(null)}
    />
  );
}

if (showHistory) {
  return (
    <WorkoutHistory
      userId={userId}
      onBack={() => setShowHistory(false)}
    />
  );
}

if (showPlanner) {
  return (
    <WorkoutPlanner
      userId={userId}
      onBack={() => setShowPlanner(false)}
    />
  );
}

if (showProgress) {
  return (
    <ProgressScreen
      userId={userId}
      onBack={() => setShowProgress(false)}
    />
  );
}


if (showImport) {
  return (
    <ImportWorkout
      onBack={() => setShowImport(false)}
      onSaved={() => {
        setShowImport(false);
        void loadWorkouts();
      }}
    />
  );
}


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.caption}>YOUR WORKOUTS</Text>
            <Text style={styles.heading}>My Workouts</Text>
          </View>

          <TouchableOpacity onPress={onSignOut}>
            <Text style={styles.signOut}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowHistory(true)}
            >
            <Text style={styles.historyButtonText}>
                📅 View Workout History
            </Text>
            </TouchableOpacity>
        
        <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowPlanner(true)}
            >
            <Text style={styles.historyButtonText}>
                📅 Weekly Workout Planner
            </Text>
            </TouchableOpacity>
        
        <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setShowProgress(true)}
            >
            <Text style={styles.historyButtonText}>
                📈 My Progress
            </Text>
            </TouchableOpacity>


        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => setShowImport(true)}
        >
          <Text style={styles.historyButtonText}>
            ✨ Import a Workout
          </Text>
        </TouchableOpacity>


        <View style={styles.form}>
          <Text style={styles.formTitle}>
            Create a new workout
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Lower Body Day"
            placeholderTextColor="#8591A3"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={createWorkout}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Saving...' : '+ Save Workout'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Saved Workouts ({workouts.length})
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#7EE2AC"
          />
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.workoutCard}
                    onPress={() => setSelectedWorkout(item)}
                >
                    <Text style={styles.workoutTitle}>
                    💪  {item.title}  →
                    </Text>
                </TouchableOpacity>
                )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No workouts yet. Create your first one!
              </Text>
            }
            refreshing={loading}
            onRefresh={loadWorkouts}
          />
        )}
      </View>
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  caption: {
    color: '#7EE2AC',
    fontSize: 12,
    fontWeight: 'bold',
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 5,
  },
  signOut: {
    color: '#7EE2AC',
  },
  form: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#101827',
    color: '#FFFFFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#7EE2AC',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#101827',
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  workoutCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  workoutTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    color: '#A8B3C7',
    textAlign: 'center',
    marginTop: 30,
  },
  historyButton: {
  backgroundColor: '#1E293B',
  padding: 17,
  borderRadius: 12,
  marginBottom: 25,
  alignItems: 'center',
},
historyButtonText: {
color: '#7EE2AC',
fontWeight: 'bold',
fontSize: 16,
},
});
