import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Plus, Search } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { noteService, useTranslations } from '@shared';
import type { Note } from '@shared/types/note';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/ui/form-field';
import { useTheme } from '../../lib/theme-provider';

function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotesScreen() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const { theme } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadNotes = useCallback(async (q?: string) => {
    try {
      const data = q ? await noteService.searchNotes(q) : await noteService.getNotes();
      setNotes(data);
    } catch {
      Alert.alert(t('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadNotes(query.trim() || undefined);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [query, loadNotes]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setShowForm(true);
  };

  const openEdit = (note: Note) => {
    setEditing(note);
    setTitle(note.title);
    setContent(note.content);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (editing) {
        await noteService.updateNote(editing.id, { title, content });
      } else {
        await noteService.createNote({ title, content });
      }
      setShowForm(false);
      loadNotes(query.trim() || undefined);
    } catch {
      Alert.alert(t('failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (note: Note) => {
    Alert.alert(t('deleteNote'), note.title, [
      { text: tCommon('cancel'), style: 'cancel' },
      {
        text: tCommon('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await noteService.deleteNote(note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
          } catch {
            Alert.alert(t('failedToLoad'));
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <FlatList
        data={notes}
        keyExtractor={(n) => String(n.id)}
        ListHeaderComponent={
          <View className="p-4">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <View className="mt-3 flex-row items-center rounded-lg border border-border dark:border-dark-border px-3">
              <Search size={16} color="#57606a" />
              <TextInput
                className="flex-1 h-10 ml-2 text-foreground dark:text-dark-foreground"
                placeholder={t('search')}
                placeholderTextColor="#57606a"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />
            </View>
            {notes.length === 0 && !isLoading ? (
              <View className="mt-8 items-center">
                <Text className="text-lg font-medium text-foreground dark:text-dark-foreground">
                  {query ? t('noNotesFound') : t('noNotesYet')}
                </Text>
                <Text className="text-sm text-muted dark:text-dark-muted mt-2 text-center">
                  {t('startWriting')}
                </Text>
                {!query ? (
                  <Button className="mt-4" onPress={openCreate}>
                    {t('newNote')}
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
            className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
          >
            <View className="flex-row justify-between items-center">
              <Text className="flex-1 text-base font-medium text-foreground dark:text-dark-foreground mr-3" numberOfLines={1}>
                {item.title || t('untitled')}
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted">
                {formatEditedAt(item.editedAt)}
              </Text>
            </View>
            {item.content ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-1" numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}
          </Pressable>
        )}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={theme === 'dark' ? '#61dafb' : '#0583f2'} />
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color="#0d1117" />
      </Pressable>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground mb-4">
              {editing ? t('editNote') : t('newNote')}
            </Text>
            <View className="space-y-4">
              <FormField label={t('titlePlaceholder')} placeholder={t('titlePlaceholder')} value={title} onChangeText={setTitle} />
              <Text className="text-sm text-foreground dark:text-dark-foreground">{t('contentPlaceholder')}</Text>
              <TextInput
                className="min-h-[160px] rounded-lg border border-border dark:border-dark-border p-3 text-foreground dark:text-dark-foreground"
                placeholder={t('contentPlaceholder')}
                placeholderTextColor="#57606a"
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row gap-3 pt-2">
                <Button variant="outline" className="flex-1" onPress={() => setShowForm(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button className="flex-1" onPress={handleSubmit} loading={isSaving}>
                  {t('save')}
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}