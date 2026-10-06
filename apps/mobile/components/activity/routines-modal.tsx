import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react-native';
import { activityService, routineService, useTranslations } from '@shared';
import type { Activity, PrivacyStatus } from '@shared/types/activity';
import type { Routine, RoutineStatus } from '@shared/types/routine';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { OptionSelect } from '../ui/option-select';
import { DeleteModal } from '../ui/delete-modal';
import { showToast } from '../ui/toast';
import { useTheme } from '../../lib/theme-provider';
import { useColors } from '../../lib/use-colors';
import { cn } from '../../lib/cn';

const STATUS_OPTIONS: RoutineStatus[] = ['draft', 'active', 'stopped'];

interface RoutinesModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Routines manager opened from the Activities screen (web routines-modal). */
export function RoutinesModal({ visible, onClose }: RoutinesModalProps) {
  const t = useTranslations('routines');
  const tPrivacy = useTranslations('privacy');
  const tActivities = useTranslations('activities');
  const { theme } = useTheme();
  const colors = useColors();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoutineStatus>('all');
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadRoutines = useCallback(async () => {
    setIsLoading(true);
    try {
      setRoutines(await routineService.getRoutines());
    } catch {
      showToast({ title: t('failedToLoad'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (visible) {
      loadRoutines();
      setSelectedRoutineId(null);
      setSearch('');
      setStatusFilter('all');
    }
  }, [visible, loadRoutines]);

  const selectedRoutine = routines.find((r) => r.id === selectedRoutineId) ?? null;

  const filtered = routines.filter((routine) => {
    if (statusFilter !== 'all' && (routine.status ?? 'active') !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = `${routine.title} ${routine.description}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const handleRoutineCreated = (routine: Routine) => {
    setRoutines((prev) => [routine, ...prev]);
    setSelectedRoutineId(routine.id);
    setShowForm(false);
    showToast({ title: t('routineCreated'), description: t('routineCreatedDescription') });
  };

  const handleRoutineUpdated = (updated: Routine) => {
    setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setShowForm(false);
    setEditing(null);
    showToast({ title: t('routineUpdated'), description: t('routineUpdatedDescription') });
  };

  const handleStatusChange = async (routine: Routine, status: RoutineStatus) => {
    setIsUpdatingStatus(true);
    const previous = routines;
    setRoutines((prev) => prev.map((r) => (r.id === routine.id ? { ...r, status } : r)));
    try {
      const updated = await routineService.updateRoutine(routine.id, { status });
      setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      setRoutines(previous);
      showToast({ title: t('updateFailed'), variant: 'destructive' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!deleting) return;
    try {
      await routineService.deleteRoutine(deleting.id);
      const remaining = routines.filter((r) => r.id !== deleting.id);
      setRoutines(remaining);
      if (selectedRoutineId === deleting.id) setSelectedRoutineId(null);
      setDeleting(null);
      showToast({ title: t('routineDeleted'), description: t('routineDeletedDescription') });
    } catch {
      showToast({ title: t('deleteFailed'), variant: 'destructive' });
      throw new Error('delete failed');
    }
  };

  const renderStatusBadge = (status?: RoutineStatus) => {
    const value: RoutineStatus = status ?? 'active';
    return (
      <View
        className={cn(
          'rounded-md border border-border dark:border-dark-border px-1.5 py-0.5',
          value === 'draft' && 'border-dashed',
          value === 'stopped' && 'opacity-80'
        )}
      >
        <Text className="text-xs text-muted dark:text-dark-muted">{t(`status_${value}`)}</Text>
      </View>
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View className="flex-1 bg-background dark:bg-dark-background">
          {selectedRoutine ? (
            /* Detail view */
            <View className="flex-1">
              <View className="flex-row items-center gap-1 px-4 pt-3 pb-2">
                <Pressable
                  onPress={() => setSelectedRoutineId(null)}
                  className="h-9 w-9 rounded-lg items-center justify-center"
                >
                  <ChevronLeft size={20} color={colors.primary} />
                </Pressable>
                <Text className="text-sm text-muted dark:text-dark-muted">{t('backToList')}</Text>
              </View>
              <View className="px-4 py-3 border-b border-border dark:border-dark-border">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground" numberOfLines={1}>
                    {selectedRoutine.title}
                  </Text>
                  {selectedRoutine.isCompletedToday ? (
                    <Check size={16} color={colors.success} />
                  ) : null}
                  {renderStatusBadge(selectedRoutine.status)}
                  <Text className="text-xs text-muted dark:text-dark-muted">
                    {tPrivacy(selectedRoutine.privacyStatus)}
                  </Text>
                </View>
                {selectedRoutine.description ? (
                  <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">
                    {selectedRoutine.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center gap-2 mt-3">
                  {(selectedRoutine.status ?? 'active') === 'active' ? (
                    <Button
                      variant="outline"
                      className="h-9 px-3"
                      textClassName="text-sm"
                      disabled={isUpdatingStatus}
                      onPress={() => handleStatusChange(selectedRoutine, 'stopped')}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <Square size={14} color={colors.primary} />
                        <Text className="text-sm text-foreground dark:text-dark-foreground">{t('stop')}</Text>
                      </View>
                    </Button>
                  ) : (
                    <Button
                      className="h-9 px-3"
                      textClassName="text-sm"
                      disabled={isUpdatingStatus}
                      onPress={() => handleStatusChange(selectedRoutine, 'active')}
                    >
                      <View className="flex-row items-center gap-1.5">
                        <Play size={14} color={colors.primaryForeground} />
                        <Text className="text-sm text-primary-foreground dark:text-dark-primary-foreground">
                          {t('start')}
                        </Text>
                      </View>
                    </Button>
                  )}
                  <Pressable
                    onPress={() => setEditing(selectedRoutine)}
                    className="h-9 w-9 rounded-lg items-center justify-center"
                  >
                    <Pencil size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleting(selectedRoutine)}
                    className="h-9 w-9 rounded-lg items-center justify-center"
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
              <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
                <Text className="text-sm text-muted dark:text-dark-muted mb-3">
                  {t('activityCount', { count: selectedRoutine.activities.length })}
                </Text>
                {[...selectedRoutine.activities]
                  .sort((a, b) => a.position - b.position)
                  .map((item) => {
                    const isCompletedToday =
                      item.scheduledToday && item.todayCompletions >= item.completionAmount;
                    return (
                      <View
                        key={item.activityId}
                        className={cn(
                          'mb-2 rounded-xl border p-4 bg-surface dark:bg-dark-surface',
                          isCompletedToday
                            ? 'border-success/50 dark:border-dark-success/50'
                            : 'border-border dark:border-dark-border'
                        )}
                      >
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs text-muted dark:text-dark-muted">
                            {item.position + 1}
                          </Text>
                          <Text
                            className={cn(
                              'flex-1 text-base font-medium',
                              isCompletedToday
                                ? 'text-success dark:text-dark-success'
                                : 'text-foreground dark:text-dark-foreground'
                            )}
                            numberOfLines={2}
                          >
                            {item.activityTitle}
                          </Text>
                          <Text className="text-xs text-muted dark:text-dark-muted">
                            {item.todayCompletions}/{item.completionAmount}
                          </Text>
                        </View>
                        {item.description ? (
                          <Text className="text-sm text-muted dark:text-dark-muted mt-1">
                            {item.description}
                          </Text>
                        ) : null}
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                            <Text className="text-xs text-muted dark:text-dark-muted">
                              {tActivities(item.frequency)}
                            </Text>
                          </View>
                          {item.dayTime && item.dayTime !== 'notSpecified' ? (
                            <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                              <Text className="text-xs text-muted dark:text-dark-muted">
                                {tActivities(item.dayTime)}
                              </Text>
                            </View>
                          ) : null}
                          <View className="rounded-md border border-border dark:border-dark-border px-2 py-0.5">
                            <Text className="text-xs text-muted dark:text-dark-muted">
                              {tPrivacy(item.privacyStatus)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                {selectedRoutine.activities.length === 0 ? (
                  <Text className="text-sm text-muted dark:text-dark-muted">
                    {t('noActivitiesInRoutine')}
                  </Text>
                ) : null}
              </ScrollView>
            </View>
          ) : (
            /* List view */
            <View className="flex-1">
              <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
                    {t('title')}
                  </Text>
                  <Text className="text-sm text-muted dark:text-dark-muted">{t('description')}</Text>
                </View>
                <Pressable onPress={onClose} className="h-9 w-9 rounded-lg items-center justify-center">
                  <X size={20} color={colors.primary} />
                </Pressable>
              </View>
              <View className="px-4 pb-2 gap-2">
                <View className="flex-row items-center rounded-lg border border-border dark:border-dark-border px-3">
                  <Search size={16} color={colors.textMuted} />
                  <TextInput
                    className="flex-1 h-10 ml-2 text-foreground dark:text-dark-foreground"
                    placeholder={t('searchRoutines')}
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                  />
                </View>
                <View className="flex-row items-center gap-1 flex-wrap">
                  {(['all', ...STATUS_OPTIONS] as const).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setStatusFilter(value)}
                      className={cn(
                        'h-7 px-2.5 rounded-lg border items-center justify-center',
                        statusFilter === value
                          ? 'bg-primary dark:bg-dark-primary border-primary dark:border-dark-primary'
                          : 'border-border dark:border-dark-border'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs',
                          statusFilter === value
                            ? 'text-primary-foreground dark:text-dark-primary-foreground'
                            : 'text-muted dark:text-dark-muted'
                        )}
                      >
                        {value === 'all' ? t('allStatuses') : t(`status_${value}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {isLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(r) => String(r.id)}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => setSelectedRoutineId(item.id)}
                      className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text
                          className="flex-1 text-base font-medium text-foreground dark:text-dark-foreground"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <View className="flex-row items-center gap-1.5">
                          {item.isCompletedToday ? (
                            <Check size={16} color={colors.success} />
                          ) : null}
                          {renderStatusBadge(item.status)}
                        </View>
                      </View>
                      <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                        {t('activityCount', { count: item.activities.length })}
                      </Text>
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <View className="items-center py-10 px-6">
                      <ListChecks size={32} color={colors.primary} />
                      <Text className="text-sm text-muted dark:text-dark-muted mt-3 text-center">
                        {routines.length === 0 ? t('noRoutines') : t('noMatchingRoutines')}
                      </Text>
                    </View>
                  }
                  contentContainerClassName="pb-24"
                />
              )}
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
              >
                <Plus size={26} color={colors.primaryForeground} />
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      <RoutineFormModal
        visible={showForm}
        routine={editing}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={editing ? handleRoutineUpdated : handleRoutineCreated}
      />

      <DeleteModal
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('deleteRoutine')}
        itemName={deleting?.title ?? ''}
        itemDetails={
          deleting ? (
            <View>
              <Text className="text-sm font-medium text-foreground dark:text-dark-foreground">
                {deleting.title}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {t('activityCount', { count: deleting.activities.length })}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-1">
                {t('deleteRoutineKeepsActivities')}
              </Text>
            </View>
          ) : null
        }
        confirmLabel={t('deleteRoutine')}
        onConfirm={handleDeleteRoutine}
      />
    </>
  );
}

interface RoutineFormModalProps {
  visible: boolean;
  routine: Routine | null;
  onClose: () => void;
  onSaved: (routine: Routine) => void;
}

function RoutineFormModal({ visible, routine, onClose, onSaved }: RoutineFormModalProps) {
  const t = useTranslations('routines');
  const tCommon = useTranslations('common');
  const tPrivacy = useTranslations('privacy');
  const colors = useColors();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<PrivacyStatus>('private');
  const [status, setStatus] = useState<RoutineStatus>('active');
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Activity[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(routine?.title ?? '');
    setDescription(routine?.description ?? '');
    setPrivacyStatus(routine?.privacyStatus ?? 'private');
    setStatus(routine?.status ?? 'active');
    setSelected([]);
    (async () => {
      try {
        const activities = await activityService.getActivities();
        setAllActivities(activities);
        if (routine) {
          setSelected(
            [...routine.activities]
              .sort((a, b) => a.position - b.position)
              .map((ra) => {
                const found = activities.find((a) => a.id === ra.activityId);
                return found ?? ({ id: ra.activityId, title: ra.activityTitle } as Activity);
              })
          );
        }
      } catch {
        showToast({ title: t('failedToLoadActivities'), variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, routine]);

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
      showToast({ title: t('validationError'), description: t('titleLabel'), variant: 'destructive' });
      return;
    }
    if (selected.length === 0) {
      showToast({ title: t('validationError'), description: t('selectAtLeastOne'), variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        privacyStatus,
        status,
        activityIds: selected.map((a, i) => ({ activityId: a.id, position: i })),
      };
      const saved = routine
        ? await routineService.updateRoutine(routine.id, payload)
        : await routineService.createRoutine(payload);
      onSaved(saved);
    } catch {
      showToast({
        title: routine ? t('updateFailed') : t('createFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
        <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
          <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
            {routine ? t('editTitle') : t('createTitle')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <FormField label={t('titleLabel')} placeholder={t('titlePlaceholder')} value={title} onChangeText={setTitle} />
            <View className="h-4" />
            <FormField
              label={t('descriptionLabel')}
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
            />
            <View className="h-4" />
            <OptionSelect
              label={t('statusLabel')}
              value={status}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status_${s}`) }))}
              onSelect={(v) => setStatus(v as RoutineStatus)}
            />
            <View className="h-4" />
            <OptionSelect
              label={tPrivacy('privacyStatus')}
              value={privacyStatus}
              options={[
                { value: 'private', label: tPrivacy('private') },
                { value: 'public', label: tPrivacy('public') },
              ]}
              onSelect={(v) => setPrivacyStatus(v as PrivacyStatus)}
            />
            <View className="h-4" />
            <Text className="text-sm text-foreground dark:text-dark-foreground">
              {t('selectedActivities')}
            </Text>
            <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">{t('orderHint')}</Text>
            {selected.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-2">
                {t('noActivitiesSelectedYet')}
              </Text>
            ) : (
              selected.map((a, index) => (
                <View
                  key={a.id}
                  className="flex-row items-center rounded-lg border border-border dark:border-dark-border p-3 mt-2"
                >
                  <Text className="flex-1 text-foreground dark:text-dark-foreground" numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Pressable onPress={() => move(index, -1)} disabled={index === 0} className="p-1">
                    <ChevronUp size={18} color={index === 0 ? colors.textMuted : colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => move(index, 1)}
                    disabled={index === selected.length - 1}
                    className="p-1"
                  >
                    <ChevronDown size={18} color={index === selected.length - 1 ? colors.textMuted : colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => setSelected((prev) => prev.filter((x) => x.id !== a.id))}
                    className="p-1 ml-1"
                  >
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))
            )}

            <Text className="text-sm text-foreground dark:text-dark-foreground mt-4">
              {t('useExistingActivities')}
            </Text>
            {allActivities
              .filter((a) => !selected.some((s) => s.id === a.id))
              .map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setSelected((prev) => [...prev, a])}
                  className="rounded-lg border border-border dark:border-dark-border p-3 mt-2"
                >
                  <Text className="text-foreground dark:text-dark-foreground">{a.title}</Text>
                </Pressable>
              ))}
            {allActivities.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-2">
                {t('noActivitiesToPick')}
              </Text>
            ) : null}

            <View className="flex-row gap-3 pt-4 pb-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                {tCommon('cancel')}
              </Button>
              <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                {routine ? t('updateRoutine') : t('createRoutine')}
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
