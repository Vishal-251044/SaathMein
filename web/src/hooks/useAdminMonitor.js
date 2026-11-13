'use client';

/**
 * useAdminMonitor — TanStack Query hooks for the console monitors, actions, alerts, Team
 * and audit log, plus useStaffLive: one staff socket that refreshes monitors on
 * `monitor:changed` and alerts on `alert:new` / `alert:updated`. While the socket is down,
 * monitor queries poll every 30 s (fallback).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as monitorService from '@/services/adminMonitor.service';
import { getStaffSocket } from '@/lib/staffSocket';
import { MONITOR_POLL_MS, STAFF_SOCKET_EVENTS } from '@/utils/constants';

export const monitorKeys = {
  all: ['admin', 'monitor'],
  overview: (filters) => ['admin', 'monitor', 'overview', filters],
  groups: (filters) => ['admin', 'monitor', 'groups', filters],
  auctions: (filters) => ['admin', 'monitor', 'auctions', filters],
  auction: (groupId) => ['admin', 'monitor', 'auction', groupId],
  paymentSummary: (filters) => ['admin', 'monitor', 'payment-summary', filters],
  payments: (filters) => ['admin', 'monitor', 'payments', filters],
  dealers: (filters) => ['admin', 'monitor', 'dealers', filters],
  buyers: (filters) => ['admin', 'monitor', 'buyers', filters],
  disputes: ['admin', 'monitor', 'disputes'],
  system: ['admin', 'monitor', 'system'],
  alerts: ['admin', 'alerts'],
  team: ['admin', 'team'],
  audit: (filters) => ['admin', 'audit', filters],
};

/* ------------------------------ live connection ------------------------------ */

let connected = false;
const listeners = new Set();
const setConnected = (value) => {
  connected = value;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** @returns {boolean} true while the staff socket is connected */
export function useStaffSocketConnected() {
  return useSyncExternalStore(
    subscribe,
    () => connected,
    () => false,
  );
}

/** Poll monitors only while the socket is down. */
const pollWhenOffline = () => (connected ? false : MONITOR_POLL_MS);

/**
 * Connect the staff socket once (mounted by the console shell) and refresh queries on
 * live events.
 * @param {{ onAlert?: (alert: Object) => void }} [options]
 */
export function useStaffLive({ onAlert } = {}) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getStaffSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onChanged = (payload = {}) => {
      if (payload.groupId) {
        queryClient.invalidateQueries({ queryKey: monitorKeys.auction(payload.groupId) });
      }
      queryClient.invalidateQueries({ queryKey: monitorKeys.all });
    };
    const onNewAlert = (alert) => {
      queryClient.invalidateQueries({ queryKey: monitorKeys.alerts });
      onAlert?.(alert);
    };
    const onAlertUpdated = () => queryClient.invalidateQueries({ queryKey: monitorKeys.alerts });

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(STAFF_SOCKET_EVENTS.MONITOR_CHANGED, onChanged);
    socket.on(STAFF_SOCKET_EVENTS.ALERT_NEW, onNewAlert);
    socket.on(STAFF_SOCKET_EVENTS.ALERT_UPDATED, onAlertUpdated);
    if (!socket.connected) socket.connect();
    else setConnected(true);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(STAFF_SOCKET_EVENTS.MONITOR_CHANGED, onChanged);
      socket.off(STAFF_SOCKET_EVENTS.ALERT_NEW, onNewAlert);
      socket.off(STAFF_SOCKET_EVENTS.ALERT_UPDATED, onAlertUpdated);
    };
  }, [queryClient, onAlert]);
}

/* ---------------------------------- queries ---------------------------------- */

/** @param {Object} filters @returns Overview query */
export const useOverview = (filters) =>
  useQuery({
    queryKey: monitorKeys.overview(filters),
    queryFn: () => monitorService.getOverview(filters),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhenOffline,
  });

/** @param {Object} filters @returns Groups monitor query */
export const useGroupsMonitor = (filters) =>
  useQuery({
    queryKey: monitorKeys.groups(filters),
    queryFn: () => monitorService.getGroupsMonitor(filters),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhenOffline,
  });

/** @param {Object} filters @returns Auctions list query */
export const useMonitorAuctions = (filters) =>
  useQuery({
    queryKey: monitorKeys.auctions(filters),
    queryFn: () => monitorService.listAuctions(filters),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhenOffline,
  });

/** @param {string} groupId @returns Auction detail query (bid timeline) */
export const useMonitorAuction = (groupId) =>
  useQuery({
    queryKey: monitorKeys.auction(groupId),
    queryFn: () => monitorService.getAuction(groupId),
    refetchInterval: () => (connected ? false : 10_000),
  });

/** @param {Object} filters @returns Payment summary query */
export const usePaymentSummary = (filters) =>
  useQuery({
    queryKey: monitorKeys.paymentSummary(filters),
    queryFn: () => monitorService.getPaymentSummary(filters),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhenOffline,
  });

/** @param {Object} filters @returns Payments list query */
export const useMonitorPayments = (filters) =>
  useQuery({
    queryKey: monitorKeys.payments(filters),
    queryFn: () => monitorService.listPayments(filters),
    placeholderData: keepPreviousData,
  });

/** @param {Object} filters @returns Dealers monitor query */
export const useMonitorDealers = (filters) =>
  useQuery({
    queryKey: monitorKeys.dealers(filters),
    queryFn: () => monitorService.listDealers(filters),
    placeholderData: keepPreviousData,
  });

/** @param {Object} filters @returns Buyers monitor query */
export const useMonitorBuyers = (filters) =>
  useQuery({
    queryKey: monitorKeys.buyers(filters),
    queryFn: () => monitorService.getBuyers(filters),
    placeholderData: keepPreviousData,
  });

/** @param {boolean} enabled @returns Disputes SLA query */
export const useDisputesMonitor = (enabled = true) =>
  useQuery({
    queryKey: monitorKeys.disputes,
    queryFn: monitorService.getDisputesMonitor,
    enabled,
    refetchInterval: pollWhenOffline,
  });

/** @returns System health query (refreshes every 30 s: API metrics are not pushed) */
export const useSystemHealth = () =>
  useQuery({
    queryKey: monitorKeys.system,
    queryFn: monitorService.getSystemHealth,
    refetchInterval: MONITOR_POLL_MS,
  });

/** @param {Object} filters @returns Alerts query */
export const useAlerts = (filters = {}) =>
  useQuery({
    queryKey: [...monitorKeys.alerts, filters],
    queryFn: () => monitorService.listAlerts(filters),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhenOffline,
  });

/** @returns Team query (Owner) */
export const useTeam = () =>
  useQuery({ queryKey: monitorKeys.team, queryFn: monitorService.getTeam });

/** @param {Object} filters @returns Audit log query */
export const useAuditLog = (filters) =>
  useQuery({
    queryKey: monitorKeys.audit(filters),
    queryFn: () => monitorService.listAuditLogs(filters),
    placeholderData: keepPreviousData,
  });

/* --------------------------------- mutations --------------------------------- */

/** @returns Mutation `{ path, body }` that refreshes every monitor after the action */
export function useMonitorAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: monitorService.runAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: monitorKeys.all }),
  });
}

/** @returns Mutation `{ alertId, action }` */
export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: monitorService.updateAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: monitorKeys.alerts }),
  });
}

/**
 * Team mutation that stores the returned team.
 * @param {(input: Object) => Promise<Object>} mutationFn
 */
const useTeamMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (team) => queryClient.setQueryData(monitorKeys.team, team),
  });
};

/** @returns Mutation `{ email, role }` */
export const useInviteStaff = () => useTeamMutation(monitorService.inviteStaff);
/** @returns Mutation `inviteId` */
export const useRevokeInvite = () => useTeamMutation(monitorService.revokeInvite);
/** @returns Mutation `{ userId, role, reason }` */
export const useChangeRole = () => useTeamMutation(monitorService.changeRole);
/** @returns Mutation `{ userId, active, reason }` */
export const useSetStaffStatus = () => useTeamMutation(monitorService.setStaffStatus);

/**
 * Seconds left until a date, ticking every second (auction timers).
 * @param {string|null} endsAt
 * @returns {number|null}
 */
export function useSecondsLeft(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
}
