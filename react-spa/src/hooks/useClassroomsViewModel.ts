import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Classroom } from '../types';
import { isAdmin } from '../lib/auth';
import { toClassrooms } from '../lib/classrooms';
import { trpc } from '../lib/trpc';
import { reportError } from '../lib/reportError';
import { useAllowedGroups } from './useAllowedGroups';
import { useListDetailSelection } from './useListDetailSelection';
import { normalizeSearchTerm, useNormalizedSearch } from './useNormalizedSearch';

export function filterClassroomsBySearch(
  classrooms: Classroom[],
  normalizedSearchQuery: string
): Classroom[] {
  if (!normalizedSearchQuery) {
    return classrooms;
  }

  return classrooms.filter(
    (room) =>
      normalizeSearchTerm(room.name).includes(normalizedSearchQuery) ||
      (room.activeGroup
        ? normalizeSearchTerm(room.activeGroup).includes(normalizedSearchQuery)
        : false)
  );
}

export function useClassroomsViewModel() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newError, setNewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const normalizedSearchQuery = useNormalizedSearch(searchQuery);
  const admin = isAdmin();

  const {
    groups: allowedGroups,
    groupById,
    options: groupOptions,
    isLoading: groupsLoading,
    error: groupsQueryError,
    refetch: refetchGroups,
  } = useAllowedGroups();

  const fetchClassrooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const apiClassrooms = await trpc.classrooms.list.query();
      const mappedClassrooms = toClassrooms(apiClassrooms);
      setClassrooms(mappedClassrooms);
      return mappedClassrooms;
    } catch (err) {
      reportError('Failed to fetch classrooms:', err);
      setError('Error al cargar aulas');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClassrooms();
  }, [fetchClassrooms]);

  const filteredClassrooms = useMemo(
    () => filterClassroomsBySearch(classrooms, normalizedSearchQuery),
    [classrooms, normalizedSearchQuery]
  );

  const {
    selectedId: selectedClassroomId,
    selectedItem: selectedClassroom,
    setSelectedId: setSelectedClassroomId,
  } = useListDetailSelection(filteredClassrooms);

  const allowedGroupsError = groupsQueryError ? 'Error al cargar aulas' : null;
  const isInitialLoading = loading || groupsLoading;
  const loadError = error ?? allowedGroupsError;

  const calendarGroupsForDisplay = useMemo(
    () =>
      allowedGroups.map((group) => ({
        id: group.id,
        displayName: group.displayName || group.name,
      })),
    [allowedGroups]
  );

  const refetchClassrooms = useCallback(async () => {
    try {
      const apiClassrooms = await trpc.classrooms.list.query();
      const mappedClassrooms = toClassrooms(apiClassrooms);
      setClassrooms(mappedClassrooms);
      return mappedClassrooms;
    } catch (err) {
      reportError('Failed to refetch classrooms:', err);
      return [];
    }
  }, []);

  const retryLoad = useCallback(() => {
    void refetchGroups();
    void fetchClassrooms();
  }, [refetchGroups, fetchClassrooms]);

  const openNewModal = useCallback(() => {
    setNewName('');
    setNewGroup('');
    setNewError('');
    setShowNewModal(true);
  }, []);

  const closeNewModal = useCallback(() => {
    if (saving) {
      return;
    }

    setShowNewModal(false);
  }, [saving]);

  const setNewNameValue = useCallback((value: string) => {
    setNewName(value);
    setNewError('');
  }, []);

  const handleCreateClassroom = useCallback(async () => {
    if (!newName.trim()) {
      setNewError('El nombre del aula es obligatorio');
      return;
    }

    try {
      setSaving(true);
      setNewError('');
      const created = await trpc.classrooms.create.mutate({
        name: newName.trim(),
        defaultGroupId: newGroup || undefined,
      });
      const updated = await refetchClassrooms();
      const createdClassroom = updated.find((classroom) => classroom.id === created.id);
      if (createdClassroom) {
        setSelectedClassroomId(createdClassroom.id);
      }
      setNewName('');
      setNewGroup('');
      setShowNewModal(false);
    } catch (err) {
      reportError('Failed to create classroom:', err);
      setNewError('Error al crear aula');
    } finally {
      setSaving(false);
    }
  }, [newName, newGroup, refetchClassrooms, setSelectedClassroomId]);

  const openDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) {
      return;
    }

    setShowDeleteConfirm(false);
  }, [deleting]);

  const handleDeleteClassroom = useCallback(async () => {
    if (!selectedClassroom) {
      return;
    }

    try {
      setDeleting(true);
      await trpc.classrooms.delete.mutate({ id: selectedClassroom.id });
      const updated = await refetchClassrooms();
      setSelectedClassroomId(updated[0]?.id ?? null);
      setShowDeleteConfirm(false);
    } catch (err) {
      reportError('Failed to delete classroom:', err);
    } finally {
      setDeleting(false);
    }
  }, [selectedClassroom, refetchClassrooms, setSelectedClassroomId]);

  return {
    admin,
    allowedGroups,
    groupById,
    groupOptions,
    calendarGroupsForDisplay,
    filteredClassrooms,
    isInitialLoading,
    loadError,
    searchQuery,
    setSearchQuery,
    selectedClassroom,
    selectedClassroomId,
    setSelectedClassroomId,
    refetchClassrooms,
    retryLoad,
    newModal: {
      isOpen: showNewModal,
      saving,
      newName,
      newGroup,
      newError,
      open: openNewModal,
      close: closeNewModal,
      setName: setNewNameValue,
      setGroup: setNewGroup,
      create: handleCreateClassroom,
    },
    deleteDialog: {
      isOpen: showDeleteConfirm,
      deleting,
      open: openDeleteConfirm,
      close: closeDeleteConfirm,
      confirm: handleDeleteClassroom,
    },
  };
}
