
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type Session = {
  id: string;
  finished_at: string | null;
  started_at: string;
};

type SessionExercise = {
  id: string;
  name_snapshot: string;
};

type SetLog = {
  session_exercise_id: string;
  actual_reps: number | null;
  weight_kg: number | string | null;
  completed_at: string | null;
};

type RecordItem = {
  name: string;
  weight: number;
};

type Stats = {
  workouts: number;
  completedSets: number;
  volume: number;
  weeklyCounts: number[];
  records: RecordItem[];
};

type Props = {
  userId: string;
  onBack: () => void;
};

function mondayOf(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(
    result.getDate() - ((result.getDay() + 6) % 7)
  );
  return result;
}

function dateKey(date: Date): string {
  return (
    date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

const emptyStats: Stats = {
  workouts: 0,
  completedSets: 0,
  volume: 0,
  weeklyCounts: [0, 0, 0, 0],
  records: [],
};

export default function ProgressScreen({
  userId,
  onBack,
}: Props) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentMonday = mondayOf(new Date());
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(currentMonday);
    date.setDate(date.getDate() - (3 - index) * 7);
    return date;
  });

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const current = mondayOf(new Date());
      const first = new Date(current);
      first.setDate(first.getDate() - 21);

      const weekStarts = Array.from(
        { length: 4 },
        (_, index) => {
          const date = new Date(first);
          date.setDate(date.getDate() + index * 7);
          return dateKey(date);
        }
      );

      const { data: sessions, error: sessionError } =
        await supabase
          .from('workout_sessions')
          .select('id, finished_at, started_at')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .gte('finished_at', first.toISOString())
          .lte('finished_at', new Date().toISOString())
          .order('finished_at', { ascending: false })
          .limit(100);

      if (sessionError) throw sessionError;

      const completedSessions = (sessions ?? []) as Session[];

      const weeklyCounts = weekStarts.map((week) =>
        completedSessions.filter((session) => {
          const date = new Date(
            session.finished_at ?? session.started_at
          );
          return dateKey(mondayOf(date)) === week;
        }).length
      );

      if (completedSessions.length === 0) {
        setStats({
          ...emptyStats,
          weeklyCounts,
        });
        return;
      }

      const sessionIds = completedSessions.map((s) => s.id);

      const { data: exercises, error: exerciseError } =
        await supabase
          .from('session_exercises')
          .select('id, name_snapshot')
          .in('session_id', sessionIds);

      if (exerciseError) throw exerciseError;

      const exerciseRows = (exercises ?? []) as SessionExercise[];
      const exerciseIds = exerciseRows.map((e) => e.id);

      if (exerciseIds.length === 0) {
        setStats({
          ...emptyStats,
          workouts: completedSessions.length,
          weeklyCounts,
        });
        return;
      }

      const { data: logs, error: logError } =
        await supabase
          .from('set_logs')
          .select(
            'session_exercise_id, actual_reps, weight_kg, completed_at'
          )
          .in('session_exercise_id', exerciseIds)
          .not('completed_at', 'is', null);

      if (logError) throw logError;

      const completedLogs = (logs ?? []) as SetLog[];

      const exerciseMap = new Map(
        exerciseRows.map((e) => [e.id, e.name_snapshot])
      );

      const personalRecords = new Map<string, RecordItem>();
      let totalVolume = 0;

      for (const log of completedLogs) {
        const weight = Number(log.weight_kg ?? 0);
        const reps = log.actual_reps ?? 0;

        if (!Number.isFinite(weight)) continue;

        totalVolume += weight * reps;

        const name = exerciseMap.get(log.session_exercise_id);
        if (!name || weight <= 0) continue;

        const key = name.trim().toLowerCase();
        const previous = personalRecords.get(key);

        if (!previous || weight > previous.weight) {
          personalRecords.set(key, { name, weight });
        }
      }

      setStats({
        workouts: completedSessions.length,
        completedSets: completedLogs.length,
        volume: totalVolume,
        weeklyCounts,
        records: [...personalRecords.values()]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Loading failed'
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const maxCount = Math.max(1, ...stats.weeklyCounts);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← My Workouts</Text>
      </TouchableOpacity>

      <Text style={styles.caption}>YOUR FITNESS JOURNEY</Text>
      <Text style={styles.title}>My Progress</Text>
      <Text style={styles.subtitle}>
        Your last four calendar weeks
      </Text>

      {loading ? (
        <ActivityIndicator color="#7EE2AC" size="large" />
      ) : errorMessage ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => void loadProgress()}>
            <Text style={styles.back}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.muted}>Workouts</Text>
              <Text style={styles.statValue}>{stats.workouts}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.muted}>Completed sets</Text>
              <Text style={styles.statValue}>
                {stats.completedSets}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.muted}>Total training volume</Text>
            <Text style={styles.statValue}>
              {Math.round(stats.volume).toLocaleString('en-ZA')} kg
            </Text>
            <Text style={styles.note}>
              Sum of recorded weight × reps; excludes bodyweight.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Workout Consistency</Text>

            <View style={styles.chart}>
              {stats.weeklyCounts.map((count, index) => (
                <View key={index} style={styles.barColumn}>
                  <Text style={styles.barCount}>{count}</Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(
                          4,
                          Math.round(125 * count / maxCount)
                        ),
                        backgroundColor: count
                          ? '#7EE2AC'
                          : '#334155',
                      },
                    ]}
                  />
                  <Text style={styles.weekLabel}>
                    {weeks[index].toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Heaviest Recorded Weights</Text>
            <Text style={styles.note}>
              Best recorded set per exercise during this period
            </Text>

            {stats.records.length === 0 ? (
              <Text style={styles.muted}>
                No weighted sets recorded yet.
              </Text>
            ) : (
              stats.records.map((record) => (
                <View key={record.name.toLowerCase()} style={styles.recordRow}>
                  <Text style={styles.recordName}>
                    {record.name}
                  </Text>
                  <Text style={styles.recordWeight}>
                    {record.weight} kg
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => void loadProgress()}
          >
            <Text style={styles.refreshText}>Refresh Progress</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 24, paddingTop: 65, paddingBottom: 70 },
  back: { color: '#7EE2AC', marginBottom: 25, fontSize: 15 },
  caption: { color: '#7EE2AC', fontSize: 12, fontWeight: 'bold' },
  title: {
    color: '#FFFFFF', fontSize: 32, fontWeight: 'bold', marginTop: 8,
  },
  subtitle: { color: '#A8B3C7', marginTop: 8, marginBottom: 25 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: '#1E293B', padding: 18,
    borderRadius: 14, marginBottom: 12,
  },
  statValue: {
    color: '#FFFFFF', fontSize: 29,
    fontWeight: 'bold', marginTop: 10,
  },
  muted: { color: '#A8B3C7', fontSize: 14 },
  note: { color: '#A8B3C7', fontSize: 12, marginVertical: 10 },
  card: {
    backgroundColor: '#1E293B', padding: 20,
    borderRadius: 14, marginBottom: 15,
  },
  heading: {
    color: '#FFFFFF', fontSize: 19,
    fontWeight: 'bold', marginBottom: 15,
  },
  chart: {
    height: 185, flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
  },
  bar: { width: 36, borderRadius: 7 },
  barCount: { color: '#FFFFFF', marginBottom: 8 },
  weekLabel: { color: '#A8B3C7', fontSize: 11, marginTop: 10 },
  recordRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#344155',
  },
  recordName: { color: '#FFFFFF', fontSize: 14, flex: 1 },
  recordWeight: { color: '#7EE2AC', fontWeight: 'bold' },
  refreshButton: {
    padding: 15, borderRadius: 12,
    backgroundColor: '#334155', alignItems: 'center',
  },
  refreshText: { color: '#7EE2AC', fontWeight: 'bold' },
});
