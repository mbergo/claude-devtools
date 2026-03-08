/**
 * Tab UI slice - manages per-tab UI state (expansion states, scroll positions, etc.)
 *
 * This slice provides COMPLETE isolation of UI state between tabs. Each tab has its
 * own independent state for:
 * - AI group expansion (collapsed/expanded)
 * - Display item expansion within AI groups
 * - Subagent trace expansion
 * - Context panel visibility
 * - Scroll position
 *
 * The state is keyed by tabId, so opening the same session in two tabs gives each
 * tab its own independent UI state.
 */

import type { AppState } from '../types';
import type { StateCreator } from 'zustand';

// =============================================================================
// Types
// =============================================================================

/**
 * UI state for a single tab.
 * All values are optional - defaults are applied when reading.
 */
export interface TabUIState {
  /** Whether AI groups are expanded by default (true = expanded, false = collapsed) */
  aiGroupsExpandedByDefault: boolean;

  /**
   * AI groups that have been manually toggled away from the default.
   * When aiGroupsExpandedByDefault is true, this set tracks collapsed groups.
   * When aiGroupsExpandedByDefault is false, this set tracks expanded groups.
   */
  expandedAIGroupIds: Set<string>;

  /** Which display items within AI groups are expanded: Map<aiGroupId, Set<itemId>> */
  expandedDisplayItemIds: Map<string, Set<string>>;

  /** Which subagent traces are manually expanded (by subagentId) */
  expandedSubagentTraceIds: Set<string>;

  /** Whether the context panel is visible */
  showContextPanel: boolean;

  /** Selected context phase for filtering (null = current/latest phase) */
  selectedContextPhase: number | null;

  /** Saved scroll position for restoring when switching back to this tab */
  savedScrollTop?: number;
}

/**
 * Creates a default/empty TabUIState.
 */
function createDefaultTabUIState(): TabUIState {
  return {
    aiGroupsExpandedByDefault: true,
    expandedAIGroupIds: new Set(),
    expandedDisplayItemIds: new Map(),
    expandedSubagentTraceIds: new Set(),
    showContextPanel: false,
    selectedContextPhase: null,
    savedScrollTop: undefined,
  };
}

// =============================================================================
// Slice Interface
// =============================================================================

export interface TabUISlice {
  /** Per-tab UI states: Map<tabId, TabUIState> */
  tabUIStates: Map<string, TabUIState>;

  // Initialization & cleanup
  /** Initialize UI state for a new tab */
  initTabUIState: (tabId: string) => void;
  /** Clean up UI state when a tab is closed */
  cleanupTabUIState: (tabId: string) => void;

  // AI Group expansion (per-tab)
  /** Toggle AI group expansion for a specific tab */
  toggleAIGroupExpansionForTab: (tabId: string, aiGroupId: string) => void;
  /** Check if AI group is expanded for a specific tab */
  isAIGroupExpandedForTab: (tabId: string, aiGroupId: string) => boolean;
  /** Expand AI group for a specific tab (for auto-expand scenarios) */
  expandAIGroupForTab: (tabId: string, aiGroupId: string) => void;
  /** Get whether AI groups are expanded by default for a specific tab */
  getAIGroupsExpandedByDefaultForTab: (tabId: string) => boolean;
  /** Toggle the expand-by-default setting for a specific tab (clears manual overrides) */
  toggleAIGroupsExpandedByDefaultForTab: (tabId: string) => void;

  // Display item expansion (per-tab)
  /** Toggle display item expansion within an AI group for a specific tab */
  toggleDisplayItemExpansionForTab: (tabId: string, aiGroupId: string, itemId: string) => void;
  /** Get expanded display item IDs for an AI group in a specific tab */
  getExpandedDisplayItemIdsForTab: (tabId: string, aiGroupId: string) => Set<string>;
  /** Expand a display item for a specific tab (for auto-expand scenarios) */
  expandDisplayItemForTab: (tabId: string, aiGroupId: string, itemId: string) => void;

  // Subagent trace expansion (per-tab)
  /** Toggle subagent trace expansion for a specific tab */
  toggleSubagentTraceExpansionForTab: (tabId: string, subagentId: string) => void;
  /** Expand subagent trace for a specific tab (no-op if already expanded) */
  expandSubagentTraceForTab: (tabId: string, subagentId: string) => void;
  /** Check if subagent trace is expanded for a specific tab */
  isSubagentTraceExpandedForTab: (tabId: string, subagentId: string) => boolean;

  // Context panel (per-tab)
  /** Set context panel visibility for a specific tab */
  setContextPanelVisibleForTab: (tabId: string, visible: boolean) => void;
  /** Get context panel visibility for a specific tab */
  isContextPanelVisibleForTab: (tabId: string) => boolean;

  // Context phase selection (per-tab)
  /** Set the selected context phase for a specific tab */
  setSelectedContextPhaseForTab: (tabId: string, phase: number | null) => void;

  // Scroll position (per-tab)
  /** Save scroll position for a specific tab */
  saveScrollPositionForTab: (tabId: string, scrollTop: number) => void;
  /** Get saved scroll position for a specific tab */
  getScrollPositionForTab: (tabId: string) => number | undefined;
}

// =============================================================================
// Slice Creator
// =============================================================================

export const createTabUISlice: StateCreator<AppState, [], [], TabUISlice> = (set, get) => ({
  tabUIStates: new Map<string, TabUIState>(),

  // ==========================================================================
  // Initialization & Cleanup
  // ==========================================================================

  initTabUIState: (tabId: string) => {
    const state = get();
    if (state.tabUIStates.has(tabId)) return; // Already initialized

    const newMap = new Map(state.tabUIStates);
    newMap.set(tabId, createDefaultTabUIState());
    set({ tabUIStates: newMap });
  },

  cleanupTabUIState: (tabId: string) => {
    const state = get();
    if (!state.tabUIStates.has(tabId)) return;

    const newMap = new Map(state.tabUIStates);
    newMap.delete(tabId);
    set({ tabUIStates: newMap });
  },

  // ==========================================================================
  // AI Group Expansion
  // ==========================================================================

  toggleAIGroupExpansionForTab: (tabId: string, aiGroupId: string) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    const newExpandedIds = new Set(tabState.expandedAIGroupIds);
    if (newExpandedIds.has(aiGroupId)) {
      newExpandedIds.delete(aiGroupId);
    } else {
      newExpandedIds.add(aiGroupId);
    }

    newMap.set(tabId, { ...tabState, expandedAIGroupIds: newExpandedIds });
    set({ tabUIStates: newMap });
  },

  isAIGroupExpandedForTab: (tabId: string, aiGroupId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    const expandedByDefault = tabState?.aiGroupsExpandedByDefault ?? true;
    const isManuallyToggled = tabState?.expandedAIGroupIds.has(aiGroupId) ?? false;
    // XOR: if default is expanded and group is toggled, it's collapsed (and vice versa)
    return expandedByDefault !== isManuallyToggled;
  },

  expandAIGroupForTab: (tabId: string, aiGroupId: string) => {
    const state = get();
    // Already expanded? No-op.
    if (state.isAIGroupExpandedForTab(tabId, aiGroupId)) return;

    const newMap = new Map(state.tabUIStates);
    const currentTabState = newMap.get(tabId) ?? createDefaultTabUIState();

    // Toggle the override to make it expanded
    const newOverrides = new Set(currentTabState.expandedAIGroupIds);
    if (currentTabState.aiGroupsExpandedByDefault) {
      // Default is expanded, so this group must be in the override set (collapsed).
      // Remove it from overrides to restore to default (expanded).
      newOverrides.delete(aiGroupId);
    } else {
      // Default is collapsed, add to overrides to expand.
      newOverrides.add(aiGroupId);
    }

    newMap.set(tabId, { ...currentTabState, expandedAIGroupIds: newOverrides });
    set({ tabUIStates: newMap });
  },

  getAIGroupsExpandedByDefaultForTab: (tabId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    return tabState?.aiGroupsExpandedByDefault ?? true;
  },

  toggleAIGroupsExpandedByDefaultForTab: (tabId: string) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    // Toggle the default and clear all manual overrides
    newMap.set(tabId, {
      ...tabState,
      aiGroupsExpandedByDefault: !tabState.aiGroupsExpandedByDefault,
      expandedAIGroupIds: new Set(),
    });
    set({ tabUIStates: newMap });
  },

  // ==========================================================================
  // Display Item Expansion
  // ==========================================================================

  toggleDisplayItemExpansionForTab: (tabId: string, aiGroupId: string, itemId: string) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    const newDisplayItemMap = new Map(tabState.expandedDisplayItemIds);
    const currentSet = newDisplayItemMap.get(aiGroupId) ?? new Set<string>();
    const newSet = new Set(currentSet);

    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }

    newDisplayItemMap.set(aiGroupId, newSet);
    newMap.set(tabId, { ...tabState, expandedDisplayItemIds: newDisplayItemMap });
    set({ tabUIStates: newMap });
  },

  getExpandedDisplayItemIdsForTab: (tabId: string, aiGroupId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    return tabState?.expandedDisplayItemIds.get(aiGroupId) ?? new Set<string>();
  },

  expandDisplayItemForTab: (tabId: string, aiGroupId: string, itemId: string) => {
    const state = get();
    const tabState = state.tabUIStates.get(tabId);
    const currentSet = tabState?.expandedDisplayItemIds.get(aiGroupId);
    if (currentSet?.has(itemId)) return; // Already expanded

    const newMap = new Map(state.tabUIStates);
    const currentTabState = newMap.get(tabId) ?? createDefaultTabUIState();

    const newDisplayItemMap = new Map(currentTabState.expandedDisplayItemIds);
    const newSet = new Set(newDisplayItemMap.get(aiGroupId) ?? new Set<string>());
    newSet.add(itemId);
    newDisplayItemMap.set(aiGroupId, newSet);

    newMap.set(tabId, { ...currentTabState, expandedDisplayItemIds: newDisplayItemMap });
    set({ tabUIStates: newMap });
  },

  // ==========================================================================
  // Subagent Trace Expansion
  // ==========================================================================

  toggleSubagentTraceExpansionForTab: (tabId: string, subagentId: string) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    const newExpandedIds = new Set(tabState.expandedSubagentTraceIds);
    if (newExpandedIds.has(subagentId)) {
      newExpandedIds.delete(subagentId);
    } else {
      newExpandedIds.add(subagentId);
    }

    newMap.set(tabId, { ...tabState, expandedSubagentTraceIds: newExpandedIds });
    set({ tabUIStates: newMap });
  },

  expandSubagentTraceForTab: (tabId: string, subagentId: string) => {
    const state = get();
    const tabState = state.tabUIStates.get(tabId) ?? createDefaultTabUIState();

    // No-op if already expanded
    if (tabState.expandedSubagentTraceIds.has(subagentId)) return;

    const newExpandedIds = new Set(tabState.expandedSubagentTraceIds);
    newExpandedIds.add(subagentId);

    const newMap = new Map(state.tabUIStates);
    newMap.set(tabId, { ...tabState, expandedSubagentTraceIds: newExpandedIds });
    set({ tabUIStates: newMap });
  },

  isSubagentTraceExpandedForTab: (tabId: string, subagentId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    return tabState?.expandedSubagentTraceIds.has(subagentId) ?? false;
  },

  // ==========================================================================
  // Context Panel
  // ==========================================================================

  setContextPanelVisibleForTab: (tabId: string, visible: boolean) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    newMap.set(tabId, { ...tabState, showContextPanel: visible });
    set({ tabUIStates: newMap });
  },

  isContextPanelVisibleForTab: (tabId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    return tabState?.showContextPanel ?? false;
  },

  // ==========================================================================
  // Context Phase Selection
  // ==========================================================================

  setSelectedContextPhaseForTab: (tabId: string, phase: number | null) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();
    newMap.set(tabId, { ...tabState, selectedContextPhase: phase });
    set({ tabUIStates: newMap });
  },

  // ==========================================================================
  // Scroll Position
  // ==========================================================================

  saveScrollPositionForTab: (tabId: string, scrollTop: number) => {
    const state = get();
    const newMap = new Map(state.tabUIStates);
    const tabState = newMap.get(tabId) ?? createDefaultTabUIState();

    newMap.set(tabId, { ...tabState, savedScrollTop: scrollTop });
    set({ tabUIStates: newMap });
  },

  getScrollPositionForTab: (tabId: string) => {
    const tabState = get().tabUIStates.get(tabId);
    return tabState?.savedScrollTop;
  },
});
