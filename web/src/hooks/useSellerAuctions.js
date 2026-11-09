'use client';

/**
 * useSellerAuctions — TanStack Query hooks for dealer auctions and seller-led deals, plus
 * useAuctionLive (Socket.io room for one auction, with polling while the socket is down)
 * and useCountdown for the auction timer.
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as auctionService from '@/services/sellerAuction.service';
import { getSellerSocket } from '@/lib/sellerSocket';
import { AUCTION_POLL_MS, SOCKET_EVENTS } from '@/utils/constants';

export const auctionKeys = {
  list: (tab, page) => ['seller', 'auctions', tab, page],
  detail: (groupId) => ['seller', 'auction', groupId],
  deals: (page) => ['seller', 'deals', page],
};

/** @param {'live'|'upcoming'|'won'} tab @param {number} page @returns Query */
export function useAuctionList(tab, page = 1) {
  return useQuery({
    queryKey: auctionKeys.list(tab, page),
    queryFn: () => auctionService.listAuctions({ tab, page }),
    placeholderData: keepPreviousData,
    refetchInterval: tab === 'live' ? 30_000 : false,
  });
}

/**
 * One auction for the bid screen. Polls only while the live connection is down.
 * @param {string} groupId
 * @param {{ current: boolean }} liveRef - true while the socket room is joined
 * @returns Query
 */
export function useSellerAuction(groupId, liveRef) {
  return useQuery({
    queryKey: auctionKeys.detail(groupId),
    queryFn: () => auctionService.getAuction(groupId),
    refetchInterval: () => (liveRef.current ? false : AUCTION_POLL_MS),
  });
}

/**
 * Mutation that writes the returned auction view into the cache.
 * @param {(input: Object) => Promise<Object>} mutationFn
 * @returns Mutation
 */
const useAuctionMutation = (mutationFn) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (auction, input) => {
      if (auction?.groupId) queryClient.setQueryData(auctionKeys.detail(input.groupId), auction);
      else queryClient.invalidateQueries({ queryKey: auctionKeys.detail(input.groupId) });
      queryClient.invalidateQueries({ queryKey: ['seller', 'auctions'] });
    },
  });
};

/** @returns Mutation `{ groupId, deliveryBy, priceValidityDays }` */
export const useJoinAuction = () => useAuctionMutation(auctionService.joinAuction);
/** @returns Mutation `{ groupId, pricePerUnitPaise, breakdown, inclusions?, terms? }` */
export const usePlaceBid = () => useAuctionMutation(auctionService.placeBid);
/** @returns Mutation `{ groupId, reason }` (owner only) */
export const useBackOut = () => useAuctionMutation(auctionService.backOut);
/** @returns Mutation `{ groupId, accept }` */
export const useRespondRunnerUp = () => useAuctionMutation(auctionService.respondRunnerUp);

/** @param {number} page @returns Query with the dealer's deals */
export function useSellerDeals(page = 1) {
  return useQuery({
    queryKey: auctionKeys.deals(page),
    queryFn: () => auctionService.listDeals({ page }),
    placeholderData: keepPreviousData,
  });
}

/** @returns Mutation that publishes a deal */
export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: auctionService.createDeal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller', 'deals'] }),
  });
}

/**
 * Catalog search for the deal form.
 * @param {string} q - Search text (2+ characters)
 * @param {string} [cityId]
 * @returns Query
 */
export function useProductSearch(q, cityId) {
  return useQuery({
    queryKey: ['seller', 'product-search', q, cityId],
    queryFn: () => auctionService.searchProducts({ q, cityId }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  });
}

/**
 * Live updates for one auction (AUC-6): joins the auction room once the dealer has joined
 * the auction, and merges lowest price, timer and my rank into the cached auction.
 * @param {string} groupId
 * @param {boolean} joined - Dealer accepted the commitment
 * @returns {{ isLive: boolean, flash: number }} `flash` changes on every new lowest price
 */
export function useAuctionLive(groupId, joined) {
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (!joined) return undefined;
    const socket = getSellerSocket();
    const key = auctionKeys.detail(groupId);
    const merge = (changes) =>
      queryClient.setQueryData(key, (current) => (current ? { ...current, ...changes } : current));

    const join = () =>
      socket.emit(SOCKET_EVENTS.AUCTION_JOIN, { groupId }, (ack) => setIsLive(Boolean(ack?.ok)));
    const onDisconnect = () => setIsLive(false);
    const onLowest = (numbers) => {
      merge(numbers);
      setFlash((value) => value + 1);
    };
    const onExtended = ({ endsAt, extensions, closedAt }) =>
      merge({
        endsAt,
        ...(extensions != null ? { extensions } : {}),
        ...(closedAt ? { closedAt } : {}),
      });
    const onRank = (rank) => {
      if (rank.groupId !== groupId) return;
      merge({
        myRank: rank.rank,
        myBestPricePaise: rank.myBestPricePaise,
        lowestPricePaise: rank.lowestPricePaise,
      });
    };
    // The result changes many fields (winner, members, deal codes): fetch it fresh
    const onWon = () => queryClient.invalidateQueries({ queryKey: key });

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.AUCTION_LOWEST, onLowest);
    socket.on(SOCKET_EVENTS.AUCTION_EXTENDED, onExtended);
    socket.on(SOCKET_EVENTS.AUCTION_RANK, onRank);
    socket.on(SOCKET_EVENTS.AUCTION_WON, onWon);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.AUCTION_LOWEST, onLowest);
      socket.off(SOCKET_EVENTS.AUCTION_EXTENDED, onExtended);
      socket.off(SOCKET_EVENTS.AUCTION_RANK, onRank);
      socket.off(SOCKET_EVENTS.AUCTION_WON, onWon);
    };
  }, [groupId, joined, queryClient]);

  return { isLive: joined && isLive, flash };
}

/**
 * Seconds left until a time, ticking every second.
 * @param {string|Date|null} endsAt
 * @returns {number|null} Seconds (0 when passed), null without a time
 */
export function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
}

/**
 * Product details (variants) for the deal form.
 * @param {string|null} productId
 * @param {string} [cityId]
 * @returns Query
 */
export function useDealProduct(productId, cityId) {
  return useQuery({
    queryKey: ['seller', 'deal-product', productId, cityId],
    queryFn: () => auctionService.getProduct({ productId, cityId }),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  });
}
