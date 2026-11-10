@file:OptIn(ExperimentalFoundationApi::class)

package com.lifetracker.feature.notes

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DragIndicator
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.halilibo.richtext.markdown.Markdown
import com.halilibo.richtext.ui.BasicRichText
import com.halilibo.richtext.ui.RichTextThemeProvider
import com.lifetracker.core.designsystem.AppHeader
import com.lifetracker.core.designsystem.LbButton
import com.lifetracker.core.designsystem.LbButtonVariant
import com.lifetracker.core.designsystem.LbDeleteConfirm
import com.lifetracker.core.designsystem.LbModalSheet
import com.lifetracker.core.designsystem.LbTextField
import com.lifetracker.core.designsystem.LocalAppColors
import com.lifetracker.core.designsystem.NavEntry
import com.lifetracker.core.designsystem.ToastHost
import com.lifetracker.core.designsystem.rememberToastState
import com.lifetracker.core.i18n.I18n
import com.lifetracker.core.network.model.NoteGroupResponse
import com.lifetracker.core.network.model.NoteResponse
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableCollectionItemScope
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/** Field-length cap of the RN group name input (`maxLength={100}`). */
private const val MAX_GROUP_NAME = 100

/**
 * Port of the RN notes screen `app/(app)/notes.tsx`: ungrouped notes first,
 * then collapsible note groups; drag-reorder of notes and groups (membership
 * inferred from the final row order); server search with a 400 ms debounce;
 * persisted editing drafts; markdown preview in the editor; delete confirms
 * for notes and groups.
 */
@Composable
fun NotesScreen(
    onNavigate: (String) -> Unit = {},
    viewModel: NotesViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val toast = rememberToastState()
    val scope = rememberCoroutineScope()
    val colors = LocalAppColors.current

    // ---- RN notes.tsx useState family ----
    var collapsed by remember { mutableStateOf(emptySet<Int>()) }
    var menuGroupId by remember { mutableStateOf<Int?>(null) }

    // Note editor (RN bottom-sheet modal → LbModalSheet).
    var showForm by rememberSaveable { mutableStateOf(false) }
    var editing by remember { mutableStateOf<NoteResponse?>(null) }
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }
    var hasUnsavedChanges by remember { mutableStateOf(false) }
    var showPreview by rememberSaveable { mutableStateOf(false) }
    var noteToDelete by remember { mutableStateOf<NoteResponse?>(null) }

    // Group form (create/rename) + delete confirmation state.
    var showGroupForm by rememberSaveable { mutableStateOf(false) }
    var renamingGroup by remember { mutableStateOf<NoteGroupResponse?>(null) }
    var groupName by remember { mutableStateOf("") }
    var isGroupSaving by remember { mutableStateOf(false) }
    var groupToDelete by remember { mutableStateOf<NoteGroupResponse?>(null) }

    // ---- focus effect + async feedback ----
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is NotesEvent.NotesLoadFailed ->
                    toast.show(toastText(t("failedToLoad"), event.error), isError = true)
                is NotesEvent.GroupsLoadFailed ->
                    toast.show(toastText(t("failedToLoad"), event.error), isError = true)
                is NotesEvent.ReorderFailed ->
                    toast.show(toastText(I18n.t("common.error"), event.error), isError = true)
            }
        }
    }

    // ---- editor helpers (RN openCreate / openEdit / handleDiscard / effect) ----

    fun openCreate() {
        editing = null
        title = ""
        content = ""
        hasUnsavedChanges = false
        showPreview = false
        showForm = true
    }

    fun openEdit(note: NoteResponse) {
        editing = note
        val draft = viewModel.drafts.load(note.id)
        if (draft != null) {
            title = draft.title
            content = draft.content
            hasUnsavedChanges = draft.title != note.title || draft.content != note.content
            toast.show(toastText(t("draftRestored"), t("draftRestoredDescription")))
        } else {
            title = note.title
            content = note.content
            hasUnsavedChanges = false
        }
        showPreview = false
        showForm = true
    }

    fun handleDiscard() {
        val note = editing ?: return
        viewModel.discardDraft(note.id)
        title = note.title
        content = note.content
        hasUnsavedChanges = false
    }

    /** The RN persist-while-typing effect lives here (title/content setters). */
    fun onEditorChange(newTitle: String, newContent: String) {
        val note = editing ?: return
        title = newTitle
        content = newContent
        hasUnsavedChanges = newTitle != note.title || newContent != note.content
        viewModel.syncEditorDraft(note.id, note.title, note.content, newTitle, newContent)
    }

    fun handleSubmit() {
        val target = editing
        scope.launch {
            isSaving = true
            val error = viewModel.saveNote(target?.id, title, content)
            isSaving = false
            if (error == null) {
                showForm = false
                editing = null
                hasUnsavedChanges = false
                toast.show(
                    toastText(
                        if (target != null) t("noteSaved") else t("noteCreated"),
                        if (target != null) t("noteSavedDescription") else t("startWriting"),
                    ),
                )
            } else {
                // The RN handler leaves the modal open on a failed save.
                toast.show(toastText(t("failedToSave"), error), isError = true)
            }
        }
    }

    // ---- group helpers ----

    fun openCreateGroup() {
        renamingGroup = null
        groupName = ""
        showGroupForm = true
    }

    fun openRenameGroup(group: NoteGroupResponse) {
        menuGroupId = null
        renamingGroup = group
        groupName = group.name
        showGroupForm = true
    }

    fun handleGroupSubmit() {
        val target = renamingGroup
        val name = groupName.trim()
        if (name.isEmpty()) return
        scope.launch {
            isGroupSaving = true
            val error = viewModel.saveGroup(target?.id, name)
            isGroupSaving = false
            if (error == null) {
                showGroupForm = false
                renamingGroup = null
                groupName = ""
                if (target == null) toast.show(t("groupCreated"))
            } else {
                toast.show(
                    toastText(
                        if (target != null) I18n.t("common.error") else t("failedToCreateGroup"),
                        error,
                    ),
                    isError = true,
                )
            }
        }
    }

    fun confirmDeleteNote() {
        val note = noteToDelete ?: return
        scope.launch {
            val error = viewModel.deleteNote(note)
            if (error == null) {
                noteToDelete = null
                toast.show(toastText(t("noteDeleted"), t("noteDeletedDescription")))
            } else {
                // RN re-throws so the confirm modal stays open.
                toast.show(toastText(I18n.t("common.error"), error), isError = true)
            }
        }
    }

    fun confirmDeleteGroup() {
        val group = groupToDelete ?: return
        scope.launch {
            val error = viewModel.deleteGroup(group)
            if (error == null) {
                // Deletion un-collapses the group; its notes return ungrouped
                // through the refetch done inside the VM.
                collapsed = collapsed - group.id
                groupToDelete = null
                toast.show(t("groupDeleted"))
            } else {
                toast.show(toastText(t("failedToDeleteGroup"), error), isError = true)
            }
        }
    }

    // ---- drag & drop ----

    val rows = remember(state.notes, state.groups, state.query, collapsed) {
        buildRows(state.notes, state.groups, state.query, collapsed)
    }

    // Live row list during a drag: `onMove` swaps items here; the final
    // ordering semantics are applied on drag end (RN `handleDragEnd`).
    var dragRows by remember { mutableStateOf(rows) }
    var dragFrom by remember { mutableIntStateOf(-1) }
    var dragTo by remember { mutableIntStateOf(-1) }

    val lazyListState = rememberLazyListState()
    // The header block occupies lazy item index 0 → drag indexes shift by 1.
    val headerIndexShift = 1
    val reorderableState = rememberReorderableLazyListState(lazyListState) { from, to ->
        val fromIndex = from.index - headerIndexShift
        val toIndex = to.index - headerIndexShift
        if (fromIndex != toIndex && fromIndex in dragRows.indices && toIndex in dragRows.indices) {
            dragRows = dragRows.toMutableList().apply { add(toIndex, removeAt(fromIndex)) }
            dragFrom = fromIndex
            dragTo = toIndex
            menuGroupId = null
        }
    }
    LaunchedEffect(rows) {
        if (!reorderableState.isAnyItemDragging) dragRows = rows
    }

    fun handleDragStart() {
        menuGroupId = null
    }

    fun handleDragStop() {
        if (dragFrom != dragTo && dragTo in dragRows.indices) {
            viewModel.onDragEnd(dragRows, dragTo)
        }
        dragFrom = -1
        dragTo = -1
    }

    // ---- layout ----

    Box(modifier = Modifier.fillMaxSize().background(colors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            AppHeader(
                title = "LifeTracker",
                items = navItems().map { (key, icon) -> NavEntry(key, I18n.t("nav.$key"), icon) },
                currentKey = "notes",
                onNavigate = onNavigate,
            )

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                state = lazyListState,
                contentPadding = PaddingValues(bottom = 96.dp),
            ) {
                // ===================== RN ListHeaderComponent =====================
                item(key = "header") {
                    ListHeader(
                        isSearching = state.isSearching,
                        query = state.query,
                        onQueryChange = viewModel::setQuery,
                        hasNotes = state.notes.isNotEmpty(),
                        isLoading = state.isLoading,
                        onAddGroup = ::openCreateGroup,
                        onNewNote = ::openCreate,
                    )
                }

                if (state.isLoading && rows.isEmpty()) {
                    // ===================== RN ListEmptyComponent =====================
                    item(key = "loading") {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(color = colors.primary)
                        }
                    }
                } else {
                    items(dragRows, key = { it.key }) { row ->
                        ReorderableItem(reorderableState, key = row.key) { isDragging ->
                            when (row) {
                                is NoteListRow.NoteRow -> NoteCard(
                                    row = row,
                                    isSearching = state.isSearching,
                                    hasDraft = row.note.id in state.draftIds,
                                    isDragging = isDragging,
                                    onOpen = ::openEdit,
                                    onDelete = { noteToDelete = row.note },
                                    onDragStart = ::handleDragStart,
                                    onDragStop = ::handleDragStop,
                                )

                                is NoteListRow.GroupRow -> GroupListing(
                                    row = row,
                                    isSearching = state.isSearching,
                                    expanded = state.isSearching || row.group.id !in collapsed,
                                    menuOpen = menuGroupId == row.group.id,
                                    isDragging = isDragging,
                                    onMenuToggle = { if (menuGroupId == row.group.id) menuGroupId = null else menuGroupId = row.group.id },
                                    onRename = ::openRenameGroup,
                                    onDeleteMenuClick = {
                                        menuGroupId = null
                                        groupToDelete = row.group
                                    },
                                    onCollapseToggle = { collapsed = if (row.group.id in collapsed) collapsed - row.group.id else collapsed + row.group.id },
                                    onDragStart = ::handleDragStart,
                                    onDragStop = ::handleDragStop,
                                )
                            }
                        }
                    }
                }
            }
        }

        // ---- FAB (opens the note editor) ----
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 24.dp)
                .size(56.dp)
                .clip(CircleShape)
                .background(colors.primary)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = ::openCreate,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.Add,
                contentDescription = t("newNote"),
                tint = colors.primaryForeground,
                modifier = Modifier.size(26.dp),
            )
        }

        // Toast overlay above everything (RN global toast port).
        ToastHost(state = toast)
    }

    // ---- note editor modal (RN slide-up modal → LbModalSheet) ----
    LbModalSheet(
        visible = showForm,
        onDismiss = { showForm = false },
        title = if (editing != null) t("editNote") else t("newNote"),
    ) {
        NoteEditor(
            editing = editing,
            title = title,
            content = content,
            isSaving = isSaving,
            hasUnsavedChanges = hasUnsavedChanges,
            showPreview = showPreview,
            onTitleChange = { onEditorChange(it, content) },
            onContentChange = { onEditorChange(title, it) },
            onTogglePreview = { showPreview = !showPreview },
            onDiscard = ::handleDiscard,
            onSave = ::handleSubmit,
            onCancel = { showForm = false },
        )
    }

    // ---- group create / rename modal ----
    LbModalSheet(
        visible = showGroupForm,
        onDismiss = { showGroupForm = false },
        title = if (renamingGroup != null) t("renameGroup") else t("createGroup"),
    ) {
        LbTextField(
            value = groupName,
            onValueChange = { if (it.length <= MAX_GROUP_NAME) groupName = it },
            label = t("groupName"),
            placeholder = t("groupName"),
            singleLine = true,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        ) {
            LbButton(
                text = I18n.t("common.cancel"),
                onClick = { showGroupForm = false },
                variant = LbButtonVariant.SECONDARY,
                enabled = !isGroupSaving,
                modifier = Modifier.weight(1f),
            )
            LbButton(
                text = if (renamingGroup != null) t("rename") else t("createGroup"),
                onClick = ::handleGroupSubmit,
                loading = isGroupSaving,
                enabled = groupName.isNotBlank(),
                modifier = Modifier.weight(1f),
            )
        }
    }

    // ---- delete confirmations (RN DeleteModal × 2) ----
    LbDeleteConfirm(
        visible = noteToDelete != null,
        name = noteToDelete?.title ?: t("untitled"),
        onDismiss = { noteToDelete = null },
        title = t("deleteNote"),
        message = t("deleteModal.areYouSure", "name" to (noteToDelete?.title ?: t("untitled"))),
        deleteLabel = t("deleteNote"),
        onConfirm = ::confirmDeleteNote,
    )
    LbDeleteConfirm(
        visible = groupToDelete != null,
        name = groupToDelete?.name ?: "",
        onDismiss = { groupToDelete = null },
        title = t("deleteGroupConfirmTitle"),
        message =
            t("deleteModal.areYouSure", "name" to (groupToDelete?.name ?: "")) +
                "\n\n" + t("deleteGroupConfirmMessage"),
        deleteLabel = t("deleteGroup"),
        onConfirm = ::confirmDeleteGroup,
    )
}

/// ---------------------------------------------------------------------
/// Sub-components (the RN renderNoteCard / renderGroupHeader / header /
/// editor modal). Both card composables are declared as extensions of
/// [ReorderableCollectionItemScope] so the grip can install the drag handle.
/// ---------------------------------------------------------------------

/** RN `listHeader` section: title, Add group, search, empty states. */
@Composable
private fun ListHeader(
    isSearching: Boolean,
    query: String,
    onQueryChange: (String) -> Unit,
    hasNotes: Boolean,
    isLoading: Boolean,
    onAddGroup: () -> Unit,
    onNewNote: () -> Unit,
) {
    val colors = LocalAppColors.current
    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            t("title"),
            fontSize = 24.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.foreground,
        )
        Spacer(Modifier.height(12.dp))
        LbButton(
            text = t("addGroup"),
            onClick = onAddGroup,
            variant = LbButtonVariant.SECONDARY,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        LbTextField(
            value = query,
            onValueChange = onQueryChange,
            placeholder = t("search"),
        )
        // Empty list (RN: notes.length === 0 && !isLoading).
        if (!hasNotes && !isLoading) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
            ) {
                Text(
                    if (isSearching) t("noNotesFound") else t("noNotesYet"),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.foreground,
                )
                Text(
                    t("startWriting"),
                    fontSize = 14.sp,
                    color = colors.textMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                // Search-empty has no CTA (the search box hides the block).
                if (!isSearching) {
                    Spacer(Modifier.height(16.dp))
                    LbButton(text = t("newNote"), onClick = onNewNote)
                }
            }
        }
    }
}

/** RN `renderNoteCard`. */
@Composable
private fun ReorderableCollectionItemScope.NoteCard(
    row: NoteListRow.NoteRow,
    isSearching: Boolean,
    hasDraft: Boolean,
    isDragging: Boolean,
    onOpen: (NoteResponse) -> Unit,
    onDelete: () -> Unit,
    onDragStart: () -> Unit,
    onDragStop: () -> Unit,
) {
    val colors = LocalAppColors.current
    val note = row.note
    Row(
        modifier = Modifier
            // RN ScaleDecorator: visual lift while dragging.
            .graphicsLayer {
                scaleX = if (isDragging) 1.05f else 1f
                scaleY = if (isDragging) 1.05f else 1f
            }
            // RN margins: `ml-8 mr-4` indented vs `mx-4`.
            .padding(
                start = if (row.indented) 32.dp else 16.dp,
                end = if (row.indented) 16.dp else 16.dp,
                bottom = 6.dp,
            )
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.border, RoundedCornerShape(12.dp))
            .background(colors.surface)
            .combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                // Tap → editor; long-press → delete confirm.
                onClick = { onOpen(note) },
                onLongClick = onDelete,
            )
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (!isSearching) {
            // Grip handle: 200 ms long-press starts the drag (RN delayLongPress).
            Icon(
                imageVector = Icons.Outlined.DragIndicator,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier
                    .size(18.dp)
                    .longPressDraggableHandle(
                        onDragStarted = { onDragStart() },
                        onDragStopped = onDragStop,
                    ),
            )
        }
        Text(
            text = note.title.ifEmpty { t("untitled") },
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = colors.foreground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (hasDraft) {
            // Unpersisted-draft indicator (RN warning dot).
            Text(
                text = "•",
                fontSize = 12.sp,
                color = colors.warning,
            )
        }
        Icon(
            imageVector = Icons.Outlined.Delete,
            contentDescription = t("deleteNote"),
            tint = colors.textMuted,
            modifier = Modifier
                .size(15.dp)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onDelete,
                ),
        )
    }
}

/** RN `renderGroupHeader` (+ its inline ⋮ menu with Rename / Delete). */
@Composable
private fun ReorderableCollectionItemScope.GroupListing(
    row: NoteListRow.GroupRow,
    isSearching: Boolean,
    expanded: Boolean,
    menuOpen: Boolean,
    isDragging: Boolean,
    onCollapseToggle: () -> Unit,
    onMenuToggle: () -> Unit,
    onRename: (NoteGroupResponse) -> Unit,
    onDeleteMenuClick: () -> Unit,
    onDragStart: () -> Unit,
    onDragStop: () -> Unit,
) {
    val colors = LocalAppColors.current
    val group = row.group
    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(
            modifier = Modifier
                .graphicsLayer {
                    scaleX = if (isDragging) 1.05f else 1f
                    scaleY = if (isDragging) 1.05f else 1f
                }
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                .background(colors.surface)
                // Header tap: close the menu if open, else toggle collapse.
                .combinedClickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = { if (menuOpen) onMenuToggle() else onCollapseToggle() },
                )
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (!isSearching) {
                Icon(
                    imageVector = Icons.Outlined.DragIndicator,
                    contentDescription = null,
                    tint = colors.textMuted,
                    modifier = Modifier
                        .size(18.dp)
                        .longPressDraggableHandle(
                            onDragStarted = { onDragStart() },
                            onDragStopped = onDragStop,
                        ),
                )
            }
            Text(
                text = group.name,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.foreground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(100))
                    .background(colors.border)
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            ) {
                Text(
                    text = row.noteCount.toString(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = colors.textMuted,
                )
            }
            Icon(
                imageVector = if (expanded) Icons.Outlined.KeyboardArrowUp else Icons.Outlined.KeyboardArrowDown,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier.size(16.dp),
            )
            Icon(
                imageVector = Icons.Outlined.MoreVert,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier
                    .size(18.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onMenuToggle,
                    ),
            )
        }
        // ---- inline ⋮ menu (Rename | Delete) ----
        if (menuOpen) {
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                    .background(colors.background),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onRename(group) },
                        )
                        .padding(vertical = 10.dp),
                ) {
                    Spacer(Modifier.width(16.dp))
                    Icon(
                        imageVector = Icons.Outlined.Edit,
                        contentDescription = null,
                        tint = colors.textMuted,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        text = t("rename"),
                        fontSize = 14.sp,
                        color = colors.foreground,
                        modifier = Modifier.weight(1f),
                    )
                }
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(40.dp)
                        .background(colors.border),
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .weight(1f)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onDeleteMenuClick,
                        )
                        .padding(vertical = 10.dp),
                ) {
                    Spacer(Modifier.width(16.dp))
                    Icon(
                        imageVector = Icons.Outlined.Delete,
                        contentDescription = null,
                        tint = colors.danger,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        text = t("deleteGroup"),
                        fontSize = 14.sp,
                        color = colors.danger,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

/// ---------------------------------------------------------------------
/// Editor modal content: title + content (+ markdown preview swap), the
/// "last edited" line, Discard link, Cancel/Save buttons.
/// ---------------------------------------------------------------------

@Composable
private fun NoteEditor(
    editing: NoteResponse?,
    title: String,
    content: String,
    isSaving: Boolean,
    hasUnsavedChanges: Boolean,
    showPreview: Boolean,
    onTitleChange: (String) -> Unit,
    onContentChange: (String) -> Unit,
    onTogglePreview: () -> Unit,
    onDiscard: () -> Unit,
    onSave: () -> Unit,
    onCancel: () -> Unit,
) {
    val colors = LocalAppColors.current
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Discard link when editing a note with unsaved changes.
        if (editing != null && hasUnsavedChanges) {
            Text(
                text = t("discard"),
                fontSize = 14.sp,
                color = colors.warning,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onDiscard,
                    ),
                textAlign = TextAlign.End,
            )
        }

        LbTextField(
            value = title,
            onValueChange = onTitleChange,
            label = t("titlePlaceholder"),
            placeholder = t("titlePlaceholder"),
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = t("contentPlaceholder"),
                fontSize = 14.sp,
                color = colors.foreground,
            )
            Text(
                text = if (showPreview) t("edit") else t("preview"),
                fontSize = 14.sp,
                color = colors.primary,
                modifier = Modifier
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onTogglePreview,
                    )
                    .padding(4.dp),
            )
        }

        if (showPreview) {
            MarkdownPreview(content)
        } else {
            NotesContentField(
                value = content,
                onValueChange = onContentChange,
                placeholder = t("contentPlaceholder"),
            )
        }

        if (editing != null) {
            val suffix = if (hasUnsavedChanges) " • ${t("unsavedChanges")}" else ""
            Text(
                text = t("lastEdited", "date" to formatEditedAt(editing.editedAt)) + suffix,
                fontSize = 12.sp,
                color = colors.textMuted,
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        ) {
            LbButton(
                text = I18n.t("common.cancel"),
                onClick = onCancel,
                variant = LbButtonVariant.SECONDARY,
                modifier = Modifier.weight(1f),
            )
            LbButton(
                text = t("save"),
                onClick = onSave,
                loading = isSaving,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/** The bordered multi-line content input (RN 160px min-height field). */
@Composable
private fun NotesContentField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 160.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.TopStart,
    ) {
        if (value.isEmpty()) {
            Text(placeholder, fontSize = 16.sp, color = colors.textMuted)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 140.dp),
            enabled = true,
            singleLine = false,
            textStyle = TextStyle(fontSize = 16.sp, color = colors.foreground),
            cursorBrush = SolidColor(colors.primary),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
        )
    }
}

/** RN markdown preview panel: bordered, scrollable, app-foregound ink. */
@Composable
private fun MarkdownPreview(content: String) {
    val colors = LocalAppColors.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 160.dp, max = 420.dp)
            .clip(RoundedCornerShape(8.dp))
            .border(1.dp, colors.border, RoundedCornerShape(8.dp))
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
    ) {
        RichTextThemeProvider(
            contentColorProvider = { colors.foreground },
        ) {
            BasicRichText(modifier = Modifier.fillMaxWidth()) {
                Markdown(content = content)
            }
        }
    }
}
