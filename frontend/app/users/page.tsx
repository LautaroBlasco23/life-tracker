'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { StreakBadge } from '@/components/ui/streak-badge';
import { socialService } from '@/services/social-service';
import { authService } from '@/services/auth-service';
import type {
  PublicProfileResponse,
  PublicRoutineCard,
  PublicActivityCard,
} from '@/types/user';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@/contexts/language-context';
import {
  ArrowLeft,
  Flame,
  Loader2,
  Lock,
  UserPlus,
  UserCheck,
  Clock,
  Users,
  Activity,
  ListChecks,
  UserX,
} from 'lucide-react';

interface SubscriptionEntry {
  id: number;
  sourceType: 'activity' | 'routine';
  sourceId: number;
}

function sourceKey(sourceType: 'activity' | 'routine', sourceId: number) {
  return `${sourceType}:${sourceId}`;
}

function UserProfileContent() {
  const t = useTranslations('profilePublic');
  const tSocial = useTranslations('social');
  const tActivities = useTranslations('activities');
  const tCommon = useTranslations('common');

  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get('username') ?? '';

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionIds, setSubscriptionIds] = useState<
    Record<string, number>
  >({});
  const [processingFollow, setProcessingFollow] = useState(false);
  const [processingSubs, setProcessingSubs] = useState<Set<string>>(new Set());

  const loadProfile = useCallback(async () => {
    if (!username) {
      setError(t('notFound'));
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [prof, subs] = await Promise.all([
        socialService.getUserProfile(username),
        socialService.getMySubscriptions().catch(() => []),
      ]);
      setProfile(prof);
      const idMap: Record<string, number> = {};
      for (const sub of subs) {
        idMap[sourceKey(sub.sourceType, sub.sourceId)] = sub.id;
      }
      setSubscriptionIds(idMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [username, t]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isSelf = profile
    ? authService.getCurrentUser()?.id === profile.id
    : false;

  const handleFollowToggle = async () => {
    if (!profile?.username) return;
    setProcessingFollow(true);
    try {
      if (profile.followStatus === 'accepted' || profile.isFollowing) {
        await socialService.unfollowUser(profile.username);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                followStatus: undefined,
              }
            : prev
        );
      } else {
        const status = await socialService.followUser(profile.username);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: status === 'accepted',
                followStatus: status,
              }
            : prev
        );
      }
    } catch (e) {
      showToast({
        title: tSocial('followFailed'),
        description: e instanceof Error ? e.message : tCommon('error'),
        variant: 'destructive',
      });
    } finally {
      setProcessingFollow(false);
    }
  };

  const handleSubscribeToggle = async (
    card: PublicRoutineCard | PublicActivityCard,
    type: 'routine' | 'activity'
  ) => {
    const key = sourceKey(type, card.id);
    setProcessingSubs((prev) => new Set(prev).add(key));
    try {
      if (card.subscribed) {
        const subId = subscriptionIds[key];
        if (!subId) return;
        await socialService.unsubscribe(subId);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                routines:
                  type === 'routine'
                    ? prev.routines.map((r) =>
                        r.id === card.id ? { ...r, subscribed: false } : r
                      )
                    : prev.routines,
                activities:
                  type === 'activity'
                    ? prev.activities.map((a) =>
                        a.id === card.id ? { ...a, subscribed: false } : a
                      )
                    : prev.activities,
              }
            : prev
        );
        showToast({
          title: t('unsubscribedToast', {
            name: profile?.username ? `@${profile.username}` : '',
          }),
        });
      } else {
        const sub = await socialService.subscribe(type, card.id);
        setSubscriptionIds((prev) => ({ ...prev, [key]: sub.id }));
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                routines:
                  type === 'routine'
                    ? prev.routines.map((r) =>
                        r.id === card.id ? { ...r, subscribed: true } : r
                      )
                    : prev.routines,
                activities:
                  type === 'activity'
                    ? prev.activities.map((a) =>
                        a.id === card.id ? { ...a, subscribed: true } : a
                      )
                    : prev.activities,
              }
            : prev
        );
        showToast({
          title: t('subscribedToast', {
            name: profile?.username ? `@${profile.username}` : '',
          }),
        });
      }
    } catch (e) {
      showToast({
        title: card.subscribed ? t('unsubscribeFailed') : t('subscribeFailed'),
        description: e instanceof Error ? e.message : tCommon('error'),
        variant: 'destructive',
      });
    } finally {
      setProcessingSubs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const renderSubscribeButton = (
    card: PublicRoutineCard | PublicActivityCard,
    type: 'routine' | 'activity'
  ) => {
    const key = sourceKey(type, card.id);
    const isProcessing = processingSubs.has(key);
    if (isSelf) return null;

    return (
      <Button
        variant={card.subscribed ? 'outline' : 'default'}
        size="sm"
        onClick={() => handleSubscribeToggle(card, type)}
        disabled={isProcessing}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : card.subscribed ? (
          <UserCheck className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {card.subscribed ? t('subscribed') : t('subscribe')}
      </Button>
    );
  };

  const renderRoutineCard = (routine: PublicRoutineCard) => (
    <Card key={`routine-${routine.id}`} className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground truncate">
                {routine.title}
              </h3>
              {routine.streak && routine.streak.current > 0 && (
                <StreakBadge current={routine.streak.current} size="sm" />
              )}
            </div>
            {routine.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {routine.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              {t('activitiesCount', { count: routine.activities.length })}
              {routine.streak && routine.streak.current > 0 && (
                <span className="flex items-center gap-1 ml-2">
                  <Flame className="h-3 w-3" />
                  {t('streakDays', { count: routine.streak.current })}
                </span>
              )}
            </div>
          </div>
          {renderSubscribeButton(routine, 'routine')}
        </div>
      </CardContent>
    </Card>
  );

  const renderActivityCard = (activity: PublicActivityCard) => (
    <Card key={`activity-${activity.id}`} className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground truncate">
                {activity.title}
              </h3>
              {activity.streak && activity.streak.current > 0 && (
                <StreakBadge current={activity.streak.current} size="sm" />
              )}
            </div>
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {activity.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              {tActivities(activity.frequency)}
              {activity.streak && activity.streak.current > 0 && (
                <span className="flex items-center gap-1 ml-2">
                  <Flame className="h-3 w-3" />
                  {t('streakDays', { count: activity.streak.current })}
                </span>
              )}
            </div>
          </div>
          {renderSubscribeButton(activity, 'activity')}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
          <div className="text-muted-foreground">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/social')}
            className="mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToSocial')}
          </Button>
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {t('notFound')}
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
      <Navigation />
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/social')}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSocial')}
        </Button>

        <Card className="bg-muted/30 mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <Avatar className="h-20 w-20">
                <AvatarImage
                  src={profile.profilePicUrl || '/placeholder.svg'}
                  alt={`${profile.firstName} ${profile.lastName}`}
                />
                <AvatarFallback className="text-lg">
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold text-foreground">
                    {profile.firstName} {profile.lastName}
                  </h1>
                  {profile.profilePrivacyStatus === 'private' && (
                    <Badge variant="secondary">{t('privateProfile')}</Badge>
                  )}
                  {isSelf && <Badge variant="outline">{t('thisIsYou')}</Badge>}
                </div>
                {profile.username && (
                  <p className="text-sm text-muted-foreground">
                    @{profile.username}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {profile.followersCount} {t('followers')}
                  </span>
                  <span>
                    {profile.followingCount} {t('following')}
                  </span>
                </div>
              </div>
              {!isSelf && (
                <Button
                  variant={
                    profile.followStatus === 'accepted' ? 'outline' : 'default'
                  }
                  size="sm"
                  onClick={handleFollowToggle}
                  disabled={processingFollow}
                  className="flex items-center gap-2"
                >
                  {processingFollow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : profile.followStatus === 'accepted' ||
                    profile.isFollowing ? (
                    <UserCheck className="h-4 w-4" />
                  ) : profile.followStatus === 'pending' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {profile.followStatus === 'accepted' || profile.isFollowing
                    ? tSocial('following')
                    : profile.followStatus === 'pending'
                      ? tSocial('pending')
                      : tSocial('follow')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {!profile.canViewContent ? (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {t('privateProfile')}
              </h3>
              <p className="text-muted-foreground">
                {t('lockedMessage', { name: profile.firstName })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div>
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  {t('publicRoutines')}
                  {profile.routines.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {profile.routines.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {profile.routines.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {t('noPublicRoutines')}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {profile.routines.map(renderRoutineCard)}
                </div>
              )}
            </div>

            <div>
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  {t('publicActivities')}
                  {profile.activities.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {profile.activities.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {profile.activities.length === 0 ? (
                <Card className="bg-muted/30">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {t('noPublicActivities')}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {profile.activities.map(renderActivityCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
            <Navigation />
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] lg:h-screen">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          </div>
        }
      >
        <UserProfileContent />
      </Suspense>
    </AuthGuard>
  );
}
