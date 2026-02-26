import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import { pickAndUploadServiceAttachment } from '../features/files/service';
import type { UploadedAttachment } from '../features/files/service';
import {
  addComplaintComment,
  createComplaint,
  deleteComplaint,
  listComplaintComments,
  listMyComplaints,
} from '../features/community/service';
import type { ComplaintCommentRow, ComplaintRow, ResidentUnit } from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import {
  complaintStatusDisplayLabel,
  priorityDisplayLabel,
} from '../features/presentation/status';
import { akColors, akShadow } from '../theme/alkarma';
import { formatDateTime } from '../utils/format';

type ComplaintsScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  selectedUnit: ResidentUnit | null;
  unitsLoading: boolean;
  unitsRefreshing: boolean;
  unitsErrorMessage: string | null;
  onSelectUnit: (unitId: string) => void;
  onRefreshUnits: () => Promise<void>;
  deepLinkComplaintId?: string | null;
  onConsumeDeepLinkComplaintId?: (complaintId: string) => void;
};

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

function statusBadge(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  switch (normalized) {
    case 'RESOLVED':
    case 'CLOSED':
      return { bg: 'rgba(16,185,129,0.10)', text: '#059669' };
    case 'UNDER_REVIEW':
    case 'IN_PROGRESS':
    case 'ASSIGNED':
    case 'REVIEWING':
      return { bg: 'rgba(245,158,11,0.10)', text: '#D97706' };
    case 'SUBMITTED':
    case 'NEW':
      return { bg: 'rgba(42,62,53,0.10)', text: akColors.primary };
    default:
      return { bg: 'rgba(100,116,139,0.10)', text: akColors.textMuted };
  }
}

function statusLabel(status?: string | null) {
  return complaintStatusDisplayLabel(status ?? 'NEW');
}

export function ComplaintsScreen({
  session,
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit,
  onRefreshUnits,
  deepLinkComplaintId = null,
  onConsumeDeepLinkComplaintId,
}: ComplaintsScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityOption>('MEDIUM');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRow | null>(null);
  const [complaintComments, setComplaintComments] = useState<ComplaintCommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setLoadError(null);
      try {
        const result = await listMyComplaints(session.accessToken);
        setRows(result);
      } catch (error) {
        setLoadError(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session.accessToken],
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const filteredRows = useMemo(
    () => (selectedUnitId ? rows.filter((r) => r.unitId === selectedUnitId) : rows),
    [rows, selectedUnitId],
  );

  useEffect(() => {
    if (!deepLinkComplaintId) return;
    const row = rows.find((r) => r.id === deepLinkComplaintId) ?? null;
    if (row) {
      setSelectedComplaint(row);
      onConsumeDeepLinkComplaintId?.(deepLinkComplaintId);
    }
  }, [deepLinkComplaintId, onConsumeDeepLinkComplaintId, rows]);

  useEffect(() => {
    let cancelled = false;
    const complaintId = selectedComplaint?.id;
    if (!complaintId) {
      setComplaintComments([]);
      setCommentsError(null);
      setNewCommentBody('');
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);
    void listComplaintComments(session.accessToken, complaintId)
      .then((data) => {
        if (cancelled) return;
        setComplaintComments(data.filter((row) => !row.isInternal));
      })
      .catch((error) => {
        if (cancelled) return;
        setCommentsError(extractApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedComplaint?.id, session.accessToken]);

  const submitComplaint = useCallback(async () => {
    if (!description.trim()) {
      setSubmitError('Complaint description is required.');
      toast.error('Missing description', 'Complaint description is required.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await createComplaint(session.accessToken, {
        unitId: selectedUnitId ?? undefined,
        category: category.trim() || 'General',
        description: [subject.trim(), description.trim()].filter(Boolean).join('\n\n'),
        priority,
        attachmentIds: attachments.map((a) => a.id),
      });
      setSuccessMessage('Complaint submitted successfully.');
      toast.success('Complaint submitted', 'Your complaint was submitted successfully.');
      setSubject('');
      setDescription('');
      setCategory('General');
      setPriority('MEDIUM');
      setAttachments([]);
      setShowComposer(false);
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Failed to submit complaint', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [attachments, category, description, loadData, priority, selectedUnitId, session.accessToken, subject, toast]);

  const uploadAttachment = useCallback(async () => {
    setIsUploadingAttachment(true);
    setSubmitError(null);
    try {
      const uploaded = await pickAndUploadServiceAttachment(session.accessToken);
      if (!uploaded) return;
      setAttachments((prev) => [...prev, uploaded]);
      toast.success('Attachment uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Attachment upload failed', msg);
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [session.accessToken, toast]);

  const removeAttachment = useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== fileId));
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setSubmitError(null);
      try {
        await deleteComplaint(session.accessToken, id);
        toast.success('Complaint deleted', 'Complaint was removed successfully.');
        await loadData('refresh');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('Delete failed', msg);
      } finally {
        setDeletingId(null);
      }
    },
    [loadData, session.accessToken, toast],
  );

  const handleAddComment = useCallback(async () => {
    if (!selectedComplaint?.id) return;
    if (!newCommentBody.trim()) {
      toast.error('Missing comment', 'Please type a message before sending.');
      return;
    }
    setPostingComment(true);
    setCommentsError(null);
    try {
      const created = await addComplaintComment(session.accessToken, selectedComplaint.id, {
        body: newCommentBody.trim(),
      });
      setComplaintComments((prev) => [...prev, created]);
      setNewCommentBody('');
      toast.success('Comment sent', 'Your message was added to this complaint.');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setCommentsError(msg);
      toast.error('Failed to send comment', msg);
    } finally {
      setPostingComment(false);
    }
  }, [newCommentBody, selectedComplaint?.id, session.accessToken, toast]);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8, paddingBottom: 110 },
        ]}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Complaints</Text>
          <Text style={styles.headerSubtitle}>Submit and track your complaints</Text>
        </View>

        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={akColors.success} />
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        ) : null}

        <ScreenCard title="Unit Filter" actionLabel={isRefreshing ? 'Refreshing...' : 'Reload'} onActionPress={() => void loadData('refresh')}>
          <UnitPicker
            units={units}
            selectedUnitId={selectedUnitId}
            onSelect={onSelectUnit}
            onRefresh={() => void onRefreshUnits()}
            isRefreshing={unitsRefreshing}
            title="Filter by Unit"
          />
          <InlineError message={unitsErrorMessage} />
          <InlineError message={loadError} />
          {unitsLoading ? <ActivityIndicator color={akColors.primary} /> : null}
          {selectedUnit ? (
            <Text style={styles.helperText}>Showing complaints for unit {selectedUnit.unitNumber ?? selectedUnit.id}</Text>
          ) : (
            <Text style={styles.helperText}>Showing complaints across all linked units.</Text>
          )}
        </ScreenCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Complaints</Text>
          <Text style={styles.sectionCount}>{filteredRows.length}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}><ActivityIndicator color={akColors.primary} /></View>
        ) : null}

        {!isLoading && filteredRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color={akColors.textSoft} />
            <Text style={styles.emptyTitle}>No complaints yet</Text>
            <Text style={styles.emptyText}>Tap the + button to submit your first complaint.</Text>
          </View>
        ) : null}

        {filteredRows.map((row) => {
          const canDelete = !['RESOLVED', 'CLOSED'].includes(String(row.status).toUpperCase());
          const badge = statusBadge(row.status);
          const subjectLine = (row.description ?? '').split('\n')[0] || row.complaintNumber || 'Complaint';
          const detailLine = (row.description ?? '').split('\n').slice(1).join(' ').trim() || row.description || 'No details';
          const isResolved = ['RESOLVED', 'CLOSED'].includes(String(row.status).toUpperCase());
          const isUnderReview = ['ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REVIEWING'].includes(String(row.status).toUpperCase());
          return (
            <View key={row.id} style={styles.complaintCard}>
              <Pressable
                style={styles.complaintBodyPress}
                onPress={() => setSelectedComplaint(row)}
              >
              <View style={styles.complaintTop}>
                <View style={styles.flex}>
                  <View style={styles.complaintHeaderRow}>
                    <Text style={styles.complaintNumber}>{row.complaintNumber ?? row.id}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.text }]}>{statusLabel(row.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.complaintSubject}>{subjectLine}</Text>
                  <Text style={styles.complaintDesc} numberOfLines={3}>{detailLine}</Text>
                  <Text style={styles.complaintMeta}>
                    {row.category ?? 'General'} • {row.priority ?? 'MEDIUM'} • {formatDateTime(row.createdAt)}
                  </Text>
                  <Text style={styles.complaintMeta}>Unit: {row.unit?.unitNumber ?? '—'}{row.assignedTo?.nameEN ? ` • Assigned: ${row.assignedTo.nameEN}` : ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={akColors.textSoft} />
              </View>

              <View style={styles.timelineWrap}>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.timelineText}>Submitted on {formatDateTime(row.createdAt)}</Text>
                </View>
                {(isUnderReview || isResolved) ? (
                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.timelineText}>Under review by community team</Text>
                  </View>
                ) : null}
                {isResolved ? (
                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.timelineText}>Resolved / closed</Text>
                  </View>
                ) : null}
              </View>
              </Pressable>

              {canDelete ? (
                <Pressable onPress={() => void handleDelete(row.id)} disabled={deletingId === row.id} style={[styles.deleteButton, deletingId === row.id && styles.buttonDisabled]}>
                  <Text style={styles.deleteButtonText}>{deletingId === row.id ? 'Deleting...' : 'Delete'}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => { setSubmitError(null); setShowComposer(true); }} style={styles.fab}>
        <LinearGradient colors={[akColors.primary, akColors.primaryDark]} style={styles.fabInner}>
          <Ionicons name="add" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>

      <Modal visible={showComposer} animationType="slide" transparent onRequestClose={() => setShowComposer(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowComposer(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.flex}>
                <Text style={styles.modalTitle}>Submit New Complaint</Text>
                <Text style={styles.modalSubtitle}>Report any issue or concern in your compound</Text>
              </View>
              <Pressable onPress={() => setShowComposer(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {/* submit/delete feedback is shown as toasts */}

              <Text style={styles.fieldLabel}>Complaint Type</Text>
              <View style={styles.inputShell}>
                <Ionicons name="list-outline" size={18} color={akColors.textMuted} />
                <TextInput value={category} onChangeText={setCategory} style={styles.input} placeholder="Noise / Security / Maintenance" placeholderTextColor={akColors.textSoft} />
              </View>

              <Text style={styles.fieldLabel}>Subject</Text>
              <View style={styles.inputShell}>
                <Ionicons name="document-text-outline" size={18} color={akColors.textMuted} />
                <TextInput value={subject} onChangeText={setSubject} style={styles.input} placeholder="e.g., Broken elevator" placeholderTextColor={akColors.textSoft} />
              </View>

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((value) => {
                  const active = priority === value;
                  return (
                    <Pressable key={value} onPress={() => setPriority(value)} style={[styles.priorityChip, active && styles.priorityChipActive]}>
                      <Text style={[styles.priorityChipText, active && styles.priorityChipTextActive]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Description</Text>
              <View style={[styles.inputShell, styles.multilineShell]}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={akColors.textMuted} style={styles.multilineIcon} />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                  style={[styles.input, styles.multilineInput]}
                  placeholder="Provide detailed information about your complaint..."
                  placeholderTextColor={akColors.textSoft}
                />
              </View>

              <Text style={styles.fieldLabel}>Attach Photos (Optional)</Text>
              <Pressable onPress={() => void uploadAttachment()} disabled={isUploadingAttachment} style={[styles.uploadBox, isUploadingAttachment && styles.buttonDisabled]}>
                <Ionicons name="cloud-upload-outline" size={24} color={akColors.textMuted} />
                <Text style={styles.uploadTitle}>{isUploadingAttachment ? 'Uploading...' : 'Click to upload photos'}</Text>
                <Text style={styles.uploadSub}>{attachments.length > 0 ? `${attachments.length} file(s) uploaded` : 'PNG/JPG/PDF supported'}</Text>
              </Pressable>

              {attachments.length > 0 ? (
                <View style={styles.attachmentsList}>
                  {attachments.map((file) => (
                    <View key={file.id} style={styles.attachmentItem}>
                      <View style={styles.attachmentMain}>
                        <Ionicons name="document-outline" size={14} color={akColors.textMuted} />
                        <View style={styles.flex}>
                          <Text style={styles.attachmentName} numberOfLines={1}>{file.name}</Text>
                          <Text style={styles.attachmentMeta}>{file.id}</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => removeAttachment(file.id)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowComposer(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => void submitComplaint()} disabled={isSubmitting} style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}>
                  <LinearGradient colors={[akColors.primary, akColors.primaryDark]} style={styles.submitButtonInner}>
                    {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
                    <Text style={styles.submitButtonText}>{isSubmitting ? 'Submitting...' : 'Submit'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedComplaint)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedComplaint(null)}
      >
        <View style={styles.detailModalRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setSelectedComplaint(null)} />
          <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>Complaint Details</Text>
                <Text style={styles.detailSubtitle}>Track complaint status and history.</Text>
              </View>
              <Pressable onPress={() => setSelectedComplaint(null)} style={styles.detailCloseBtn}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.detailContent}>
              {selectedComplaint ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailSummaryCard}>
                    <View style={styles.detailSummaryTop}>
                      <View style={styles.flex}>
                        <Text style={styles.detailSummaryTitle}>
                          {selectedComplaint.category ?? 'General Complaint'}
                        </Text>
                        <Text style={styles.detailSummarySub}>
                          {selectedComplaint.complaintNumber ?? selectedComplaint.id}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.detailStatusPill,
                          { backgroundColor: statusBadge(selectedComplaint.status).bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailStatusPillText,
                            { color: statusBadge(selectedComplaint.status).text },
                          ]}
                        >
                          {statusLabel(selectedComplaint.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailMiniChips}>
                      <View style={styles.detailMiniChip}>
                        <Ionicons name="flag-outline" size={12} color={akColors.textMuted} />
                        <Text style={styles.detailMiniChipText}>
                          {complaintPriorityLabel(selectedComplaint.priority)}
                        </Text>
                      </View>
                      {selectedComplaint.unit?.unitNumber ? (
                        <View style={styles.detailMiniChip}>
                          <Ionicons name="home-outline" size={12} color={akColors.textMuted} />
                          <Text style={styles.detailMiniChipText}>
                            {selectedComplaint.unit.unitNumber}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <DetailRow label="Complaint #" value={selectedComplaint.complaintNumber ?? selectedComplaint.id} />
                  <DetailRow label="Status" value={statusLabel(selectedComplaint.status)} />
                  <DetailRow label="Category" value={selectedComplaint.category ?? 'General'} />
                  <DetailRow label="Priority" value={complaintPriorityLabel(selectedComplaint.priority)} />
                  <DetailRow label="Created" value={formatDateTime(selectedComplaint.createdAt)} />
                  <DetailRow
                    label="Unit"
                    value={`${selectedComplaint.unit?.unitNumber ?? '—'}${selectedComplaint.unit?.projectName ? ` • ${selectedComplaint.unit.projectName}` : ''}`}
                  />
                  {selectedComplaint.assignedTo?.nameEN ? (
                    <DetailRow label="Assigned To" value={selectedComplaint.assignedTo.nameEN} />
                  ) : null}
                  <View style={styles.detailBlockCard}>
                    <Text style={styles.detailBlockCardLabel}>Timeline</Text>
                    {complaintTimelineRows(selectedComplaint).map((line, idx) => (
                      <View key={`${selectedComplaint.id}-tl-${idx}`} style={styles.detailTimelineRow}>
                        <View style={[styles.detailTimelineDot, idx === 0 ? styles.detailTimelineDotActive : null]} />
                        <Text style={styles.detailTimelineText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                  {selectedComplaint.description ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>Description</Text>
                      <Text style={styles.detailBlockValue}>{selectedComplaint.description}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailBlockCard}>
                    <View style={styles.detailSectionHeader}>
                      <Text style={styles.detailBlockCardLabel}>Conversation</Text>
                      <Text style={styles.detailSectionHint}>{complaintComments.length}</Text>
                    </View>
                    {commentsLoading ? (
                      <View style={styles.detailInlineLoading}>
                        <ActivityIndicator size="small" color={akColors.primary} />
                        <Text style={styles.detailInlineLoadingText}>Loading comments...</Text>
                      </View>
                    ) : null}
                    {!commentsLoading && complaintComments.length === 0 ? (
                      <Text style={styles.detailEmptyHint}>No messages yet. You can add a comment for the management team.</Text>
                    ) : null}
                    {complaintComments.map((comment) => {
                      const isMine = comment.createdById === session.userId;
                      return (
                        <View
                          key={comment.id}
                          style={[styles.commentBubble, isMine ? styles.commentBubbleMine : styles.commentBubbleOther]}
                        >
                          <Text style={styles.commentAuthorText}>
                            {commentAuthorLabel(comment, isMine)}
                          </Text>
                          <Text style={styles.commentBodyText}>{comment.body}</Text>
                          <Text style={styles.commentMetaText}>{formatDateTime(comment.createdAt)}</Text>
                        </View>
                      );
                    })}
                    <View style={styles.commentComposerWrap}>
                      <TextInput
                        value={newCommentBody}
                        onChangeText={setNewCommentBody}
                        style={styles.commentComposerInput}
                        multiline
                        placeholder="Write a message to the management team..."
                        placeholderTextColor={akColors.textSoft}
                      />
                      <Pressable
                        onPress={() => void handleAddComment()}
                        disabled={postingComment}
                        style={[styles.commentComposerBtn, postingComment && styles.buttonDisabled]}
                      >
                        <Text style={styles.commentComposerBtnText}>
                          {postingComment ? 'Sending...' : 'Send'}
                        </Text>
                      </Pressable>
                    </View>
                    {commentsError ? <Text style={styles.detailInlineErrorText}>{commentsError}</Text> : null}
                  </View>
                  {!['RESOLVED', 'CLOSED'].includes(String(selectedComplaint.status).toUpperCase()) ? (
                    <View style={styles.detailActionsRow}>
                      <Pressable
                        onPress={async () => {
                          const id = selectedComplaint.id;
                          setSelectedComplaint(null);
                          await handleDelete(id);
                        }}
                        disabled={deletingId === selectedComplaint.id}
                        style={[styles.detailDangerButton, deletingId === selectedComplaint.id && styles.buttonDisabled]}
                      >
                        <Text style={styles.detailDangerButtonText}>
                          {deletingId === selectedComplaint.id ? 'Deleting...' : 'Delete Complaint'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

function complaintPriorityLabel(priority?: string | null) {
  return priorityDisplayLabel(priority);
}

function complaintTimelineRows(complaint: ComplaintRow): string[] {
  const rows = [`Complaint submitted • ${formatDateTime(complaint.createdAt)}`];
  const status = String(complaint.status ?? '').toUpperCase();
  if (complaint.assignedTo?.nameEN) rows.push(`Assigned to ${complaint.assignedTo.nameEN}`);
  if (['ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REVIEWING'].includes(status)) {
    rows.push('Under review by community management');
  }
  if (['RESOLVED', 'CLOSED'].includes(status)) {
    rows.push('Complaint resolved / closed');
  }
  return rows;
}

function commentAuthorLabel(comment: ComplaintCommentRow, isMine: boolean) {
  if (isMine) return 'You';
  return (
    comment.createdBy?.nameEN?.trim() ||
    comment.createdBy?.nameAR?.trim() ||
    'Community Management'
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: akColors.bg },
  container: { padding: 16, gap: 14 },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    ...akShadow.soft,
  },
  headerTitle: { color: akColors.text, fontSize: 22, fontWeight: '700' },
  headerSubtitle: { marginTop: 4, color: akColors.textMuted, fontSize: 13 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.successBorder,
    backgroundColor: akColors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successBannerText: { color: akColors.success, fontSize: 12, fontWeight: '600' },
  helperText: { color: akColors.textMuted, fontSize: 12, lineHeight: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 2 },
  sectionTitle: { color: akColors.text, fontSize: 16, fontWeight: '700' },
  sectionCount: { color: akColors.primary, fontSize: 12, fontWeight: '700' },
  loadingCard: {
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    ...akShadow.soft,
  },
  emptyTitle: { color: akColors.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: akColors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  complaintCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  complaintBodyPress: {
    gap: 10,
  },
  complaintTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  complaintHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  complaintNumber: { color: akColors.primary, fontSize: 12, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  complaintSubject: { color: akColors.text, fontSize: 14, fontWeight: '700' },
  complaintDesc: { marginTop: 3, color: akColors.textMuted, fontSize: 12, lineHeight: 18 },
  complaintMeta: { marginTop: 3, color: akColors.textSoft, fontSize: 11, lineHeight: 16 },
  timelineWrap: {
    borderTopWidth: 1,
    borderColor: akColors.border,
    paddingTop: 10,
    gap: 6,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timelineDot: { width: 7, height: 7, borderRadius: 999 },
  timelineText: { color: akColors.textMuted, fontSize: 11 },
  deleteButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.16)',
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteButtonText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    ...akShadow.card,
  },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 8,
    paddingBottom: 18,
    ...akShadow.card,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalTitle: { color: akColors.text, fontSize: 17, fontWeight: '700' },
  modalSubtitle: { color: akColors.textMuted, fontSize: 12, marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  modalContent: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  fieldLabel: { color: akColors.text, fontSize: 12, fontWeight: '600' },
  inputShell: {
    borderRadius: 14,
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, padding: 0, fontSize: 14, color: akColors.text },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  priorityChipActive: { borderColor: akColors.primary, backgroundColor: 'rgba(42,62,53,0.10)' },
  priorityChipText: { color: akColors.textMuted, fontSize: 11, fontWeight: '700' },
  priorityChipTextActive: { color: akColors.primary },
  multilineShell: { alignItems: 'flex-start' },
  multilineIcon: { marginTop: 2 },
  multilineInput: { minHeight: 96, textAlignVertical: 'top' },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: akColors.border,
    borderRadius: 14,
    backgroundColor: akColors.surfaceMuted,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 5,
  },
  uploadTitle: { color: akColors.text, fontSize: 12, fontWeight: '600' },
  uploadSub: { color: akColors.textMuted, fontSize: 11 },
  attachmentsList: { gap: 8 },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  attachmentMain: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  attachmentName: { color: akColors.text, fontSize: 12, fontWeight: '600' },
  attachmentMeta: { color: akColors.textSoft, fontSize: 10 },
  removeText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4, paddingBottom: 6 },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: { color: akColors.text, fontSize: 13, fontWeight: '700' },
  submitButton: { flex: 1, borderRadius: 12, overflow: 'hidden', ...akShadow.soft },
  submitButtonInner: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: { color: akColors.white, fontSize: 13, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  flex: { flex: 1 },
  detailModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  detailSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
    paddingTop: 8,
    ...akShadow.card,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    marginBottom: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  detailCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 16,
    backgroundColor: akColors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  detailSummaryCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 14,
    backgroundColor: akColors.surface,
    padding: 10,
    gap: 8,
  },
  detailSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailSummaryTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailSummarySub: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  detailStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  detailStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailMiniChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailMiniChipText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailRowLabel: {
    flex: 1,
    color: akColors.textMuted,
    fontSize: 12,
  },
  detailRowValue: {
    flex: 1,
    textAlign: 'right',
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  detailBlock: {
    marginTop: 4,
    borderTopWidth: 1,
    borderColor: akColors.border,
    paddingTop: 8,
    gap: 4,
  },
  detailBlockCard: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    padding: 10,
    gap: 6,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailSectionHint: {
    color: akColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  detailInlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  detailInlineLoadingText: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  detailEmptyHint: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  detailBlockCardLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailTimelineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: akColors.border,
  },
  detailTimelineDotActive: {
    backgroundColor: akColors.primary,
  },
  detailTimelineText: {
    flex: 1,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  commentBubble: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  commentBubbleMine: {
    borderColor: 'rgba(42,62,53,0.18)',
    backgroundColor: 'rgba(42,62,53,0.06)',
  },
  commentBubbleOther: {
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
  },
  commentAuthorText: {
    color: akColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  commentBodyText: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  commentMetaText: {
    color: akColors.textSoft,
    fontSize: 10,
  },
  commentComposerWrap: {
    marginTop: 4,
    gap: 8,
  },
  commentComposerInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    color: akColors.text,
    fontSize: 12,
  },
  commentComposerBtn: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    backgroundColor: akColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentComposerBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailInlineErrorText: {
    color: '#B91C1C',
    fontSize: 11,
    lineHeight: 16,
  },
  detailBlockLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailBlockValue: {
    color: akColors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  detailActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  detailDangerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.16)',
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailDangerButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
});
