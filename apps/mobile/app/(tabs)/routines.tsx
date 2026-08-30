import { useCallback, useState } from 'react';
import { Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { activityService, routineService, useTranslations } from '@shared';
import type { Activity, PrivacyStatus } from '@shared/types/activity';
import type { Routine } from '@shared/types/routine';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { OptionSelect } from '../../components/ui/option-select';
import { useTheme } from '../../lib/theme-provider';
import { cn } from '../../lib/cn';

export default function RoutinesScreen() {
  const t = useTranslations('routines');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');
  const { theme } = useTheme();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [detail, setDetail] = useState<Routine | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadRoutines = useCallback(async () => {
    try {
      const data = await routineService.getRoutines();
      setRoutines(data);
    } catch {
      Alert.alert(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [loadRoutines])
  );

  const openForm = async (routine?: Routine) => {
    setEditing(routine ?? null);
    setTitle(routine?.title ?? '');
    setDescription(routine?.description ?? '');
    setPrivacyStatus(routine?.privacyStatus ?? 'private');
    setSelected([]);
    setShowForm(true);
    try {
      const activities = await activityService.getActivities();
      setAllActivities(activities);
      if (routine) {
        setSelected(
          routine.activities.map((ra) => {
            const found = activities.find((a) => a.id === ra.activityId);
            return (
              found ?? ({ id: ra.activityId, title: ra.activityTitle } as Activity)
            );
          })
        );
      }
    } catch {
      Alert.alert(t('failedToLoadActivities'));
    }
  };

  const move = (index: number, delta: number) => {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('validationError'), t('titleLabel'));
      return;
    }
    if (selected.length === 0) {
      Alert.alert(t('validationError'), t('selectAtLeastOne'));
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        privacyStatus,
        activityIds: selected.map((a, i) => ({ activityId: a.id, position: i })),
      };
      if (editing) {
        await routineService.updateRoutine(editing.id, payload);
      } else {
        await routineService.createRoutine(payload);
      }
      setShowForm(false);
      setEditing(null);
      loadRoutines();
    } catch {
      Alert.alert(t('createFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (routine: Routine) => {
    Alert.alert(t('deleteRoutine'), t('deleteRoutineKeepsActivities'), [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await routineService.deleteRoutine(routine.id);
            setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
          } catch {
            Alert.alert(t('deleteFailed'));
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <ActivityIndicator color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={routines}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={
          <View className="p-4">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1">{t('description')}</Text>
            {routines.length === 0 ? (
              <View className="mt-8 items-center">
                <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                  {t('noRoutines')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                  {t('noRoutinesDescription')}
                </Text>
                <Button className="mt-4" onPress={() => openForm()}>
                  {t('createFirstRoutine')}
                </Button>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDetail(item)}
            onLongPress={() => handleDelete(item)}
            className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
          >
            <View className="flex-row justify-between items-center">
              <View className="flex-1 mr-3">
                <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                  {item.title}
                </Text>
                {item.description ? (
                  <Text className="text-sm text-muted dark:text-dark-muted mt-0.5" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                  {t('activityCount', { count: item.activities.length })}
                </Text>
              </View>
              <Text className="text-xs text-muted dark:text-dark-muted">{item.privacyStatus}</Text>
            </View>
          </Pressable>
        )}
        contentContainerClassName="pb-24"
      />

      <Pressable
        onPress={() => openForm()}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color="#0d1117" />
      </Pressable>

      {/* Create routine modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
              {editing ? t('updateRoutine') : t('createRoutine')}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" className="space-y-4">
              <FormField label={t('titleLabel')} placeholder={t('titlePlaceholder')} value={title} onChangeText={setTitle} />
              <FormField label={t('descriptionLabel')} placeholder={t('descriptionPlaceholder')} value={description} onChangeText={setDescription} />
              <OptionSelect
                label={tPrivacy('privacyStatus')}
                value={privacyStatus}
                options={[
                  { value: 'private', label: tPrivacy('private') },
                  { value: 'public', label: tPrivacy('public') },
                ]}
                onSelect={(v) => setPrivacyStatus(v as PrivacyStatus)}
              />

              <Text className="text-sm text-foreground dark:text-dark-foreground">{t('selectedActivities')}</Text>
              {selected.length === 0 ? (
                <Text className="text-sm text-muted dark:text-dark-muted">{t('noActivitiesInRoutine')}</Text>
              ) : (
                selected.map((a, index) => (
                  <View key={a.id} className="flex-row items-center rounded-lg border border-border dark:border-dark-border p-3">
                    <Text className="flex-1 text-foreground dark:text-dark-foreground">{a.title}</Text>
                    <Pressable onPress={() => move(index, -1)} disabled={index === 0} className="p-1">
                      <ChevronUp size={18} color={index === 0 ? '#57606a' : '#61dafb'} />
                    </Pressable>
                    <Pressable onPress={() => move(index, 1)} disabled={index === selected.length - 1} className="p-1">
                      <ChevronDown size={18} color={index === selected.length - 1 ? '#57606a' : '#61dafb'} />
                    </Pressable>
                    <Pressable onPress={() => setSelected((prev) => prev.filter((x) => x.id !== a.id))} className="p-1 ml-1">
                      <Text className="text-danger dark:text-dark-danger">✕</Text>
                    </Pressable>
                  </View>
                ))
              )}

              <Text className="text-sm text-foreground dark:text-dark-foreground">{t('newActivity')}</Text>
              {allActivities
                .filter((a) => !selected.some((s) => s.id === a.id))
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => setSelected((prev) => [...prev, a])}
                    className={cn('rounded-lg border border-border dark:border-dark-border p-3')}
                  >
                    <Text className="text-foreground dark:text-dark-foreground">{a.title}</Text>
                  </Pressable>
                ))}
              {allActivities.length === 0 ? (
                <Text className="text-sm text-muted dark:text-dark-muted">{t('noActivitiesToPick')}</Text>
              ) : null}

              <View className="flex-row gap-3 pt-2">
                <Button variant="outline" className="flex-1" onPress={() => setShowForm(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                  {editing ? t('updateRoutine') : t('createRoutine')}
                </Button>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Routine detail modal */}
      <Modal visible={detail !== null} animationType="fade" transparent onRequestClose={() => setDetail(null)}>
        <View className="flex-1 justify-center bg-black/50 p-6">
          <View className="rounded-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
              {detail?.title}
            </Text>
            {detail?.description ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-1">{detail.description}</Text>
            ) : null}
            <View className="mt-4 space-y-2">
              {detail?.activities.map((a) => (
                <View key={a.activityId} className="rounded-lg border border-border dark:border-dark-border p-3">
                  <Text className="text-foreground dark:text-dark-foreground">{a.activityTitle}</Text>
                  <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                    {a.frequency} · {a.dayTime}
                  </Text>
                </View>
              ))}
            </View>
            <View className="flex-row gap-3 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => {
                  const routine = detail;
                  setDetail(null);
                  if (routine) openForm(routine);
                }}
              >
                {tCommon('edit')}
              </Button>
              <Button variant="outline" className="flex-1" onPress={() => setDetail(null)}>
                {tCommon('close')}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}