import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, Lock } from 'lucide-react-native';
import type { PublicActivityCard, PublicProfileResponse, PublicRoutineCard } from '@shared/types/user';
import { authService, socialService, useTranslations } from '@shared';
import { Button } from '../../components/ui/button';
import { useTheme } from '../../lib/theme-provider';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const t = useTranslations('profilePublic');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { theme } = useTheme();

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';
  const currentUser = authService.getCurrentUser();
  const isSelf = profile && currentUser && profile.username === currentUser.username;

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await socialService.getUserProfile(username));
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleFollowToggle = async () => {
    if (!profile) return;
    setIsProcessing(true);
    try {
      if (profile.isFollowing || profile.followStatus === 'pending') {
        await socialService.unfollowUser(profile.username!);
      } else {
        const status = await socialService.followUser(profile.username!);
        if (status === 'pending') {
          Alert.alert(t('pendingLabel'));
        }
      }
      await loadProfile();
    } catch {
      Alert.alert(tCommon('error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async (
    sourceType: 'activity' | 'routine',
    sourceId: number,
    subscribed: boolean,
    subscriptionId?: number
  ) => {
    try {
      if (subscribed && subscriptionId) {
        await socialService.unsubscribe(subscriptionId);
        Alert.alert(t('unsubscribedToast'));
      } else {
        await socialService.subscribe(sourceType, sourceId);
        Alert.alert(t('subscribedToast'));
      }
      await loadProfile();
    } catch {
      Alert.alert(subscribed ? t('unsubscribeFailed') : t('subscribeFailed'));
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background">
        <ActivityIndicator color={spinnerColor} />
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-dark-background p-6">
        <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
          {t('notFound')}
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          {t('backToSocial')}
        </Button>
      </View>
    );
  }

  const renderActivity = (activity: PublicActivityCard) => (
    <View
      key={activity.id}
      className="mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
    >
      <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
        {activity.title}
      </Text>
      {activity.description ? (
        <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">{activity.description}</Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-muted dark:text-dark-muted">
          {activity.frequency} · {activity.dayTime}
          {activity.streak ? ` · ${activity.streak.current} ${t('streakDays')}` : ''}
        </Text>
        {!isSelf ? (
          <Button
            variant={activity.subscribed ? 'outline' : 'default'}
            className="h-8 px-3"
            textClassName="text-xs"
            onPress={() => handleSubscribe('activity', activity.id, activity.subscribed)}
          >
            {activity.subscribed ? t('subscribed') : t('subscribe')}
          </Button>
        ) : null}
      </View>
    </View>
  );

  const renderRoutine = (routine: PublicRoutineCard) => (
    <View
      key={routine.id}
      className="mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
    >
      <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
        {routine.title}
      </Text>
      {routine.description ? (
        <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">{routine.description}</Text>
      ) : null}
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-muted dark:text-dark-muted">
          {routine.activities.length} ·{' '}
          {routine.streak ? `${routine.streak.current} ${t('streakDays')}` : ''}
        </Text>
        {!isSelf ? (
          <Button
            variant={routine.subscribed ? 'outline' : 'default'}
            className="h-8 px-3"
            textClassName="text-xs"
            onPress={() => handleSubscribe('routine', routine.id, routine.subscribed)}
          >
            {routine.subscribed ? t('subscribed') : t('subscribe')}
          </Button>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-background dark:bg-dark-background">
      <View className="p-4">
        <View className="flex-row items-center mb-4">
          <Button variant="ghost" className="h-9 w-9 px-0" onPress={() => router.back()}>
            <ChevronLeft size={22} color={spinnerColor} />
          </Button>
          <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground ml-1">
            @{profile.username}
          </Text>
        </View>

        <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
          {profile.firstName} {profile.lastName}
        </Text>

        <View className="flex-row gap-6 mt-3">
          <Text className="text-sm text-muted dark:text-dark-muted">
            <Text className="font-semibold text-foreground dark:text-dark-foreground">
              {profile.followersCount}
            </Text>{' '}
            {t('followers')}
          </Text>
          <Text className="text-sm text-muted dark:text-dark-muted">
            <Text className="font-semibold text-foreground dark:text-dark-foreground">
              {profile.followingCount}
            </Text>{' '}
            {t('following')}
          </Text>
        </View>

        {isSelf ? (
          <Text className="text-sm text-primary dark:text-dark-primary mt-3">{t('thisIsYou')}</Text>
        ) : (
          <Button
            className="mt-4"
            variant={profile.isFollowing || profile.followStatus === 'pending' ? 'outline' : 'default'}
            onPress={handleFollowToggle}
            loading={isProcessing}
          >
            {profile.followStatus === 'pending'
              ? t('pendingLabel')
              : profile.isFollowing
                ? t('followingLabel')
                : t('follow')}
          </Button>
        )}

        {profile.profilePrivacyStatus === 'private' && !profile.canViewContent ? (
          <View className="items-center mt-10 rounded-xl border border-border dark:border-dark-border p-8 bg-surface dark:bg-dark-surface">
            <Lock size={32} color={spinnerColor} />
            <Text className="text-lg font-medium text-foreground dark:text-dark-foreground mt-3">
              {t('privateProfile')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
              {t('lockedMessage')}
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mt-8 mb-3">
              {t('publicActivities')} ({profile.publicActivitiesCount})
            </Text>
            {profile.activities.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted">
                {t('noPublicActivities')}
              </Text>
            ) : (
              profile.activities.map(renderActivity)
            )}

            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mt-8 mb-3">
              {t('publicRoutines')} ({profile.publicRoutinesCount})
            </Text>
            {profile.routines.length === 0 ? (
              <Text className="text-sm text-muted dark:text-dark-muted">
                {t('noPublicRoutines')}
              </Text>
            ) : (
              profile.routines.map(renderRoutine)
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
