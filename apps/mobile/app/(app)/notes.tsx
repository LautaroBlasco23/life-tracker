import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Plus, Search, Trash2 } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useFocusEffect } from 'expo-router';
import { noteService, storage, useTranslations } from '@shared';
import type { Note } from '@shared/types/note';
import { Button } from '../../components/ui/button';
import { DeleteModal } from '../../components/ui/delete-modal';
import { FormField } from '../../components/ui/form-field';
import { showToast } from '../../components/ui/toast';
import { useColors } from '../../lib/use-colors';
import { Navigation } from '../../components/navigation';

const DRAFT_STORAGE_KEY = 'notes_drafts';

interface NoteDrafts {
  [noteId: number]: { title: string; content: string };
}

// Same draft semantics as web's notes page: unsaved edits are persisted per
// note through the shared storage adapter and restored on reopen.
function getDrafts(): NoteDrafts {
  const stored = storage.getItem(DRAFT_STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as NoteDrafts;
  } catch {
    storage.removeItem(DRAFT_STORAGE_KEY);
    return {};
  }
}

function saveDraft(noteId: number, title: string, content: string): void {
  const drafts = getDrafts();
  drafts[noteId] = { title, content };
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function removeDraft(noteId: number): void {
  const drafts = getDrafts();
  delete drafts[noteId];
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function loadDraft(noteId: number): { title: string; content: string } | null {
  return getDrafts()[noteId] ?? null;
}

function formatEditedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotesScreen() {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const colors = useColors();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const loadNotes = useCallback(async (q?: string) => {
    try {
      setIsLoading(true);
      const data = q ? await noteService.searchNotes(q) : await noteService.getNotes();
      setNotes(data);
    } catch (error) {
      showToast({
        title: t('failedToLoad'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
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

  // Persist the draft while the editor has unsaved changes (web parity).
  useEffect(() => {
    if (!editing || !showForm) return;
    const titleChanged = title !== editing.title;
    const contentChanged = content !== editing.content;
    const unsaved = titleChanged || contentChanged;
    setHasUnsavedChanges(unsaved);
    if (unsaved) {
      saveDraft(editing.id, title, content);
    } else {
      removeDraft(editing.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, editing, showForm]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setHasUnsavedChanges(false);
    setShowPreview(false);
    setShowForm(true);
  };

  const openEdit = (note: Note) => {
    const draft = loadDraft(note.id);
    setEditing(note);
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setHasUnsavedChanges(draft.title !== note.title || draft.content !== note.content);
      showToast({
        title: t('draftRestored'),
        description: t('draftRestoredDescription'),
      });
    } else {
      setTitle(note.title);
      setContent(note.content);
      setHasUnsavedChanges(false);
    }
    setShowPreview(false);
    setShowForm(true);
  };

  const handleDiscard = () => {
    if (!editing) return;
    removeDraft(editing.id);
    setTitle(editing.title);
    setContent(editing.content);
    setHasUnsavedChanges(false);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      let saved: Note;
      if (editing) {
        saved = await noteService.updateNote(editing.id, { title, content });
      } else {
        saved = await noteService.createNote({ title, content });
      }
      setNotes((prev) => {
        const exists = prev.some((n) => n.id === saved.id);
        return exists ? prev.map((n) => (n.id === saved.id ? saved : n)) : [saved, ...prev];
      });
      if (editing) removeDraft(editing.id);
      setEditing(null);
      setShowForm(false);
      showToast({
        title: editing ? t('noteSaved') : t('noteCreated'),
        description: editing ? t('noteSavedDescription') : t('startWriting'),
      });
    } catch (error) {
      showToast({
        title: t('failedToSave'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    const note = noteToDelete;
    try {
      await noteService.deleteNote(note.id);
      removeDraft(note.id);
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      showToast({
        title: t('noteDeleted'),
        description: t('noteDeletedDescription'),
      });
    } catch (error) {
      showToast({
        title: tCommon('error'),
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error instanceof Error ? error : new Error('delete failed');
    }
  };

  return (
    <View className="flex-1 relative bg-background dark:bg-dark-background">
      <Navigation />
      <FlatList
        data={notes}
        keyExtractor={(n) => String(n.id)}
        ListHeaderComponent={
          <View className="p-4">
            <Text className="text-2xl font-semibold text-foreground dark:text-dark-foreground">
              {t('title')}
            </Text>
            <View className="mt-3 flex-row items-center rounded-lg border border-border dark:border-dark-border px-3">
              <Search size={16} color={colors.textMuted} />
              <TextInput
                className="flex-1 h-10 ml-2 text-foreground dark:text-dark-foreground"
                placeholder={t('search')}
                placeholderTextColor={colors.textMuted}
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
        renderItem={({ item }) => {
          const hasDraft = getDrafts()[item.id] !== undefined;
          return (
          <Pressable
            onPress={() => openEdit(item)}
            onLongPress={() => setNoteToDelete(item)}
            className="mx-4 mb-2 rounded-xl border border-border dark:border-dark-border p-4 bg-surface dark:bg-dark-surface"
          >
            <View className="flex-row justify-between items-center">
              <Text className="flex-1 text-base font-medium text-foreground dark:text-dark-foreground mr-3" numberOfLines={1}>
                {item.title || t('untitled')}
              </Text>
              <View className="flex-row items-center gap-2">
                {hasDraft ? (
                  <Text className="text-xs text-warning dark:text-dark-warning">•</Text>
                ) : null}
                <Text className="text-xs text-muted dark:text-dark-muted">
                  {formatEditedAt(item.editedAt)}
                </Text>
                <Pressable onPress={() => setNoteToDelete(item)} hitSlop={8} className="p-1">
                  <Trash2 size={15} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
            {item.content ? (
              <Text className="text-sm text-muted dark:text-dark-muted mt-1" numberOfLines={2}>
                {item.content}
              </Text>
            ) : null}
          </Pressable>
          );
        }}
        contentContainerClassName="pb-24"
        ListEmptyComponent={
          isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />

      <Pressable
        onPress={openCreate}
        className="absolute bottom-6 right-5 h-14 w-14 rounded-full bg-primary dark:bg-dark-primary items-center justify-center shadow-lg"
      >
        <Plus size={26} color={colors.primaryForeground} />
      </Pressable>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
          <View className="max-h-[90%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-semibold text-foreground dark:text-dark-foreground">
                {editing ? t('editNote') : t('newNote')}
              </Text>
              {editing && hasUnsavedChanges ? (
                <Pressable onPress={handleDiscard} hitSlop={6} className="p-1">
                  <Text className="text-sm text-warning dark:text-dark-warning">
                    {t('discard')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="gap-4">
              <FormField label={t('titlePlaceholder')} placeholder={t('titlePlaceholder')} value={title} onChangeText={setTitle} />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-foreground dark:text-dark-foreground">
                  {t('contentPlaceholder')}
                </Text>
                <Pressable onPress={() => setShowPreview((s) => !s)} className="p-1">
                  <Text className="text-sm text-primary dark:text-dark-primary">
                    {showPreview ? t('edit') : t('preview')}
                  </Text>
                </Pressable>
              </View>
              {showPreview ? (
                <ScrollView className="min-h-[160px] rounded-lg border border-border dark:border-dark-border p-3" nestedScrollEnabled>
                  <Markdown
                    style={{
                      body: { color: colors.foreground },
                      heading1: { color: colors.foreground },
                      heading2: { color: colors.foreground },
                      heading3: { color: colors.foreground },
                      link: { color: colors.primary },
                      strong: { color: colors.foreground },
                      blockquote: {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                      code_inline: {
                        color: colors.foreground,
                        backgroundColor: colors.surface,
                      },
                      hr: { backgroundColor: colors.border },
                    }}
                  >
                    {content || ''}
                  </Markdown>
                </ScrollView>
              ) : (
                <TextInput
                  className="min-h-[160px] rounded-lg border border-border dark:border-dark-border p-3 text-foreground dark:text-dark-foreground"
                  placeholder={t('contentPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  textAlignVertical="top"
                />
              )}
              {editing ? (
                <Text className="text-xs text-muted dark:text-dark-muted">
                  {t('lastEdited', { date: formatEditedAt(editing.editedAt) })}
                  {hasUnsavedChanges ? ` • ${t('unsavedChanges')}` : ''}
                </Text>
              ) : null}
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
        </KeyboardAvoidingView>
      </Modal>

      <DeleteModal
        visible={noteToDelete !== null}
        onClose={() => setNoteToDelete(null)}
        title={t('deleteNote')}
        itemName={noteToDelete?.title || t('untitled')}
        confirmLabel={t('deleteNote')}
        onConfirm={handleDeleteNote}
      />
    </View>
  );
}
