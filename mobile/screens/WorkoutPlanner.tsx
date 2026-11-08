
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Workout = {
  id: string;
  title: string;
};

type ScheduledWorkout = {
  id: string;
  workout_id: string;
  scheduled_date: string;
  status: string;
};

type Props = {
  userId: string;
  onBack: () => void;
};

// Use local calendar dates, not UTC conversion.
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function weekDays(offset: number): Date[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const monday = addDays(
    today,
    -((today.getDay() + 6) % 7) + offset * 7
  );

  return Array.from({ length: 7 }, (_, i) =>
    addDays(monday, i)
  );
}

function shiftDate(value: string, amount: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return dateKey(addDays(date, amount));
}

export default function WorkoutPlanner({
  userId,
  onBack,
}: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayIndex, setDayIndex] = useState(
    (new Date().getDay() + 6) % 7
  );

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [schedule, setSchedule] =
    useState<ScheduledWorkout[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const days = weekDays(weekOffset);
  const selectedDate = dateKey(days[dayIndex]);

  const loadPlanner = useCallback(async () => {
    setLoading(true);

    try {
      const [workoutResult, scheduleResult] = await Promise.all([
        supabase
          .from('workout_templates')
          .select('id, title')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),

        supabase
          .from('scheduled_workouts')
          .select('id, workout_id, scheduled_date, status')
          .eq('user_id', userId)
          .gte('scheduled_date', dateKey(weekDays(weekOffset)[0]))
          .lte('scheduled_date', dateKey(weekDays(weekOffset)[6]))
          .order('scheduled_date', { ascending: true }),
      ]);

      if (workoutResult.error) throw workoutResult.error;
      if (scheduleResult.error) throw scheduleResult.error;

      setWorkouts(workoutResult.data ?? []);
      setSchedule(scheduleResult.data ?? []);
    } catch (error) {
      Alert.alert(
        'Planner error',
        error instanceof Error ? error.message : 'Loading failed'
      );
    } finally {
      setLoading(false);
    }
  }, [userId, weekOffset]);

  useEffect(() => {
    void loadPlanner();
  }, [loadPlanner]);

  async function scheduleWorkout(workoutId: string) {
    if (busy) return;
    setBusy('add');

    try {
      const { error } = await supabase
        .from('scheduled_workouts')
        .insert({
          user_id: userId,
          workout_id: workoutId,
          scheduled_date: selectedDate,
          status: 'planned',
        });

      if (error) throw error;

      await loadPlanner();
    } catch (error) {
      Alert.alert(
        'Could not schedule workout',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setBusy(null);
    }
  }

  async function moveWorkout(
    item: ScheduledWorkout,
    direction: number
  ) {
    if (busy) return;
    setBusy(item.id);

    try {
      const newDate = shiftDate(
        item.scheduled_date,
        direction
      );

      const { data, error } = await supabase
        .from('scheduled_workouts')
        .update({ scheduled_date: newDate })
        .eq('id', item.id)
        .eq('user_id', userId)
        .select('id')
        .single();

      if (error) throw error;
      if (!data) throw new Error('Schedule not updated');

      await loadPlanner();
    } catch (error) {
      Alert.alert(
        'Could not move workout',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setBusy(null);
    }
  }

  const selectedWorkouts = schedule.filter(
    (item) => item.scheduled_date === selectedDate
  );

  const workoutName = (id: string) =>
    workouts.find((w) => w.id === id)?.title ??
    'Unknown workout';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← My Workouts</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Weekly Planner</Text>
      <Text style={styles.subtitle}>
        Plan your week. Change it whenever you need.
      </Text>

      <View style={styles.weekHeader}>
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w - 1)}
        >
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.weekLabel}>
          {days[0].toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
          })}
          {' – '}
          {days[6].toLocaleDateString('en-ZA', {
            day: 'numeric',
            month: 'short',
          })}
        </Text>

        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w + 1)}
        >
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.daysRow}>
        {days.map((date, index) => {
          const active = index === dayIndex;
          const key = dateKey(date);
          const hasWorkout = schedule.some(
            (s) => s.scheduled_date === key
          );

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.day,
                active && styles.selectedDay,
              ]}
              onPress={() => setDayIndex(index)}
            >
              <Text style={[
                styles.dayText,
                active && styles.selectedText,
              ]}>
                {date.toLocaleDateString('en-ZA', {
                  weekday: 'short',
                })}
              </Text>

              <Text style={[
                styles.dayText,
                active && styles.selectedText,
              ]}>
                {date.getDate()}
              </Text>

              <Text style={[
                styles.dot,
                { opacity: hasWorkout ? 1 : 0 },
              ]}>●</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.heading}>Scheduled workouts</Text>

      {loading ? (
        <ActivityIndicator color="#7EE2AC" />
      ) : selectedWorkouts.length === 0 ? (
        <Text style={styles.muted}>
          Nothing scheduled for this day.
        </Text>
      ) : (
        selectedWorkouts.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.workoutTitle}>
              {workoutName(item.workout_id)}
            </Text>
            <Text style={styles.muted}>{item.status}</Text>

            <View style={styles.moveRow}>
              <TouchableOpacity
                style={styles.moveButton}
                disabled={busy !== null}
                onPress={() => moveWorkout(item, -1)}
              >
                <Text style={styles.moveText}>← Earlier</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moveButton}
                disabled={busy !== null}
                onPress={() => moveWorkout(item, 1)}
              >
                <Text style={styles.moveText}>Later →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.heading}>Add to this day</Text>

      {workouts.length === 0 && (
        <Text style={styles.muted}>
          Create a workout in My Workouts first.
        </Text>
      )}

      {workouts.map((workout) => (
        <TouchableOpacity
          key={workout.id}
          style={styles.addButton}
          disabled={busy !== null || loading}
          onPress={() => scheduleWorkout(workout.id)}
        >
          <Text style={styles.addText}>
            + {workout.title}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 24, paddingTop: 65, paddingBottom: 80 },
  back: { color: '#7EE2AC', marginBottom: 25 },
  title: {
    color: '#FFFFFF', fontSize: 30, fontWeight: 'bold',
  },
  subtitle: {
    color: '#A8B3C7', marginTop: 8, marginBottom: 25,
  },
  weekHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  weekLabel: {
    color: '#FFFFFF', fontWeight: 'bold', fontSize: 16,
  },
  arrow: { color: '#7EE2AC', fontSize: 32 },
  daysRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 35, gap: 3,
  },
  day: {
    flex: 1, backgroundColor: '#1E293B',
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center',
  },
  selectedDay: { backgroundColor: '#7EE2AC' },
  dayText: { color: '#FFFFFF', fontSize: 12 },
  selectedText: { color: '#101827', fontWeight: 'bold' },
  dot: { color: '#7EE2AC', fontSize: 10, marginTop: 4 },
  heading: {
    color: '#FFFFFF', fontSize: 19, fontWeight: 'bold',
    marginBottom: 15, marginTop: 10,
  },
  muted: { color: '#A8B3C7', fontSize: 14 },
  card: {
    backgroundColor: '#1E293B', padding: 18,
    borderRadius: 14, marginBottom: 15,
  },
  workoutTitle: {
    color: '#FFFFFF', fontSize: 17, fontWeight: 'bold',
    marginBottom: 6,
  },
  moveRow: {
    flexDirection: 'row', gap: 10, marginTop: 16,
  },
  moveButton: {
    flex: 1, backgroundColor: '#334155',
    padding: 12, borderRadius: 10, alignItems: 'center',
  },
  moveText: { color: '#7EE2AC', fontWeight: 'bold' },
  addButton: {
    backgroundColor: '#1E293B', borderRadius: 10,
    padding: 17, marginBottom: 10,
  },
  addText: { color: '#7EE2AC', fontWeight: 'bold' },
});
