import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Search, UserPlus, UserCheck } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { FollowerItem, PublicUserCard } from '@shared/types/user';
import { socialService, useTranslations } from '@shared';
import { SegmentedTabs } from '../../components/ui/segmented-tabs';
import { FormField } from '../../components/ui/form-field';
import { Button } from '../../components/ui/button';
import { showToast } from '../../components/ui/toast';
import { useTheme } from '../../lib/theme-provider';
import { Navigation } from '../../components/navigation';

type SocialView = 'search' | 'requests';

export default function SocialScreen() {
  const t = useTranslations('social');
  const router = useRouter();
  const { theme } = useTheme();

  const [view, setView] = useState<SocialView>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PublicUserCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FollowerItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  const spinnerColor = theme === 'dark' ? '#61dafb' : '#0583f2';

  const loadPendingRequests = useCallback(async () => {
    try {
      setPendingRequests(await socialService.getPendingFollowRequests());
    } catch {
      showToast({ title: t('searchFailed'), variant: 'destructive' });
    } finally {
      setIsLoadingRequests(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadPendingRequests();
    }, [loadPendingRequests])
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      try {
        setResults(await socialService.searchUsers(query.trim(), 20));
      } catch (error) {
        showToast({
          title: t('searchFailed'),
          description:
            error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      } finally {
        setIsSearching(false);
      }
    },
    [t]
  );

  // Same 300 ms debounce as web's social page.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const setProcessing = (id: number, processing: boolean) => {
    setProcessingIds((prev) =>
      processing ? [...prev, id] : prev.filter((p) => p !== id)
    );
  };

  const handleFollow = async (user: PublicUserCard) => {
    setProcessing(user.id, true);
    try {
      const status = await socialService.followUser(user.username!);
      setResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isFollowing: status === 'accepted', followStatus: status } : u
        )
      );
      showToast({
        title: status === 'accepted' ? t('followed') : t('requestSent'),
        description:
          status === 'accepted'
            ? t('nowFollowing', { name: user.firstName })
            : t('followRequestPending', { name: user.firstName }),
      });
    } catch (error) {
      showToast({
        title: t('followFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(user.id, false);
    }
  };

  const handleUnfollow = async (user: PublicUserCard) => {
    setProcessing(user.id, true);
    try {
      await socialService.unfollowUser(user.username!);
      setResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isFollowing: false, followStatus: 'none' } : u
        )
      );
      showToast({
        title: t('unfollowed'),
        description: t('noLongerFollowing', { name: user.firstName }),
      });
    } catch (error) {
      showToast({
        title: t('unfollowFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(user.id, false);
    }
  };

  const handleAccept = async (follower: FollowerItem) => {
    setProcessing(follower.userId, true);
    try {
      await socialService.acceptFollowRequest(follower.userId);
      setPendingRequests((prev) => prev.filter((r) => r.userId !== follower.userId));
      showToast({
        title: t('requestAccepted'),
        description: t('followRequestAccepted'),
      });
    } catch (error) {
      showToast({
        title: t('acceptFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(follower.userId, false);
    }
  };

  const handleReject = async (follower: FollowerItem) => {
    setProcessing(follower.userId, true);
    try {
      await socialService.rejectFollowRequest(follower.userId);
      setPendingRequests((prev) => prev.filter((r) => r.userId !== follower.userId));
      showToast({
        title: t('requestRejected'),
        description: t('followRequestRejected'),
      });
    } catch (error) {
      showToast({
        title: t('rejectFailed'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setProcessing(follower.userId, false);
    }
  };

  const renderFollowButton = (user: PublicUserCard) => {
    if (processingIds.includes(user.id)) {
      return <ActivityIndicator color={spinnerColor} />;
    }
    if (user.followStatus === 'pending') {
      return (
        <View className="px-3 py-1.5 rounded-lg bg-surface dark:bg-dark-surface">
          <Text className="text-xs text-muted dark:text-dark-muted">{t('pending')}</Text>
        </View>
      );
    }
    return user.isFollowing ? (
      <Button
        variant="outline"
        className="h-9 px-3"
        textClassName="text-sm"
        onPress={() => handleUnfollow(user)}
      >
        {t('following')}
      </Button>
    ) : (
      <Button className="h-9 px-3" textClassName="text-sm" onPress={() => handleFollow(user)}>
        {t('follow')}
      </Button>
    );
  };

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <FlatList<PublicUserCard | FollowerItem>
        data={view === 'search' ? results : pendingRequests}
        keyExtractor={(item) => String('userId' in item ? item.userId : item.id)}
        ListHeaderComponent={
          <View className="p-4 pb-0">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <Text className="text-sm text-muted dark:text-dark-muted mt-1 mb-4">{t('description')}</Text>
            <SegmentedTabs<SocialView>
              value={view}
              onChange={setView}
              options={[
                { value: 'search', label: t('findFriends') },
                { value: 'requests', label: `${t('requests')}${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` },
              ]}
            />
            {view === 'search' ? (
              <View className="mb-4">
                <FormField
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          !('userId' in item) ? (
            <View className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface">
              <View className="flex-row items-center justify-between">
                <Pressable
                  className="flex-1 mr-3"
                  onPress={() => router.push(`/user/${item.username}`)}
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-medium text-foreground dark:text-dark-foreground" numberOfLines={1}>
                      {item.firstName} {item.lastName}
                    </Text>
                    {item.profilePrivacyStatus === 'private' ? (
                      <View className="rounded-md bg-primary/10 dark:bg-dark-primary/10 px-2 py-0.5">
                        <Text className="text-xs text-muted dark:text-dark-muted">{t('private')}</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.username ? (
                    <Text className="text-sm text-muted dark:text-dark-muted mt-0.5">@{item.username}</Text>
                  ) : null}
                </Pressable>
                {renderFollowButton(item)}
              </View>
            </View>
          ) : (
            <View className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface">
              <Text className="text-base font-medium text-foreground dark:text-dark-foreground">
                {item.firstName} {item.lastName}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-0.5 mb-3">
                {item.username ? `@${item.username} · ` : ''}
                {t('wantsToFollow')}
              </Text>
              <View className="flex-row gap-3">
                <Button
                  className="flex-1 h-9"
                  textClassName="text-sm"
                  onPress={() => handleAccept(item)}
                  loading={processingIds.includes(item.userId)}
                >
                  {t('accept')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-9"
                  textClassName="text-sm"
                  onPress={() => handleReject(item)}
                >
                  {t('reject')}
                </Button>
              </View>
            </View>
          )
        }
        ListEmptyComponent={
          view === 'search' ? (
            isSearching ? (
              <ActivityIndicator color={spinnerColor} className="mt-10" />
            ) : hasSearched ? (
              <View className="items-center mt-10 px-6">
                <Search size={32} color={spinnerColor} />
                <Text className="text-lg font-medium text-foreground dark:text-dark-foreground mt-3">
                  {t('noResults')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                  {t('tryDifferentSearch')}
                </Text>
              </View>
            ) : (
              <View className="items-center mt-10 px-6">
                <UserPlus size={32} color={spinnerColor} />
                <Text className="text-sm text-muted dark:text-dark-muted mt-3 text-center">
                  {t('searchPlaceholder')}
                </Text>
              </View>
            )
          ) : isLoadingRequests ? (
            <ActivityIndicator color={spinnerColor} className="mt-10" />
          ) : (
            <View className="items-center mt-10 px-6">
              <UserCheck size={32} color={spinnerColor} />
              <Text className="text-lg font-medium text-foreground dark:text-dark-foreground mt-3">
                {t('noPendingRequests')}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                {t('requestsAppearHere')}
              </Text>
            </View>
          )
        }
        contentContainerClassName="pb-24"
      />
    </View>
  );
}
