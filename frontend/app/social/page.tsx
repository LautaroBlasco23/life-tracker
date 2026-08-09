'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthGuard } from '@/components/auth-guard';
import { Navigation } from '@/components/navigation';
import { socialService } from '@/services/social-service';
import type { PublicUserCard, Follow } from '@/types/user';
import { showToast } from '@/lib/toast';
import { useTranslations } from '@/contexts/language-context';
import {
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Users,
  User,
  Loader2,
} from 'lucide-react';

export default function SocialPage() {
  const t = useTranslations('social');
  const tCommon = useTranslations('common');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserCard[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Follow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Load pending follow requests on mount
  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      setIsLoadingPending(true);
      const requests = await socialService.getPendingFollowRequests();
      setPendingRequests(requests || []);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
      setPendingRequests([]);
    } finally {
      setIsLoadingPending(false);
    }
  };

  // Debounced search
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await socialService.searchUsers(query, 20);
        setSearchResults(results ?? []);
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

  // Handle search input change with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const handleFollow = async (user: PublicUserCard) => {
    if (!user.username) return;

    setProcessingIds((prev) => new Set(prev).add(user.id));
    try {
      const status = await socialService.followUser(user.username);
      // Update the search results to reflect the new follow status
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isFollowing: true, followStatus: status }
            : u
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleUnfollow = async (user: PublicUserCard) => {
    if (!user.username) return;

    setProcessingIds((prev) => new Set(prev).add(user.id));
    try {
      await socialService.unfollowUser(user.username);
      // Update the search results to reflect the unfollow
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, isFollowing: false, followStatus: undefined }
            : u
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleAcceptRequest = async (followerId: number) => {
    setProcessingIds((prev) => new Set(prev).add(followerId));
    try {
      await socialService.acceptFollowRequest(followerId);
      // Remove from pending requests
      setPendingRequests((prev) =>
        prev.filter((req) => req.followerId !== followerId)
      );
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(followerId);
        return next;
      });
    }
  };

  const handleRejectRequest = async (followerId: number) => {
    setProcessingIds((prev) => new Set(prev).add(followerId));
    try {
      await socialService.rejectFollowRequest(followerId);
      // Remove from pending requests
      setPendingRequests((prev) =>
        prev.filter((req) => req.followerId !== followerId)
      );
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
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(followerId);
        return next;
      });
    }
  };

  const getFollowButton = (user: PublicUserCard) => {
    const isProcessing = processingIds.has(user.id);

    if (user.isFollowing) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleUnfollow(user)}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          {t('following')}
        </Button>
      );
    }

    if (user.followStatus === 'pending') {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={true}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4" />
          {t('pending')}
        </Button>
      );
    }

    return (
      <Button
        variant="default"
        size="sm"
        onClick={() => handleFollow(user)}
        disabled={isProcessing || !user.username}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {t('follow')}
      </Button>
    );
  };

  const renderUserCard = (user: PublicUserCard, showFollowButton = true) => (
    <Card key={user.id} className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={user.profilePicUrl || '/placeholder.svg'}
              alt={`${user.firstName} ${user.lastName}`}
            />
            <AvatarFallback>
              {user.firstName[0]}
              {user.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {user.firstName} {user.lastName}
              </h3>
              {user.profilePrivacyStatus === 'private' && (
                <Badge variant="secondary" className="text-xs">
                  {t('private')}
                </Badge>
              )}
            </div>
            {user.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
          </div>
          {showFollowButton && getFollowButton(user)}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 lg:pb-0 lg:pl-64">
        <Navigation />
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              {t('title')}
            </h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>

          <Tabs defaultValue="search" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t('search')}
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('requests')}
                {pendingRequests?.length > 0 && (
                  <Badge variant="default" className="ml-1">
                    {pendingRequests?.length || 0}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-6">
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    {t('findFriends')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardContent>
              </Card>

              {isSearching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t('searchResults', { count: searchResults.length })}
                  </h2>
                  {searchResults.map((user) => renderUserCard(user))}
                </div>
              ) : searchQuery.trim() ? (
                <Card className="bg-muted/30">
                  <CardContent className="py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {t('noResults')}
                    </h3>
                    <p className="text-muted-foreground">
                      {t('tryDifferentSearch')}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="requests" className="space-y-6">
              {isLoadingPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingRequests?.length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {t('pendingRequests', {
                      count: pendingRequests?.length || 0,
                    })}
                  </h2>
                  {pendingRequests.map((request) => (
                    <Card key={request.followerId} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback>
                              <User className="h-6 w-6" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">
                              {t('userId', { id: request.followerId })}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {t('wantsToFollow')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleRejectRequest(request.followerId)
                              }
                              disabled={processingIds.has(request.followerId)}
                            >
                              {processingIds.has(request.followerId) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                              <span className="ml-2 hidden sm:inline">
                                {t('reject')}
                              </span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                handleAcceptRequest(request.followerId)
                              }
                              disabled={processingIds.has(request.followerId)}
                            >
                              {processingIds.has(request.followerId) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                              <span className="ml-2 hidden sm:inline">
                                {t('accept')}
                              </span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {t('noPendingRequests')}
                    </h3>
                    <p className="text-muted-foreground">
                      {t('requestsAppearHere')}
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
}
