"use client";

import { useEffect, useRef, useState } from "react";

export type SavedView<T> = {
  id: string;
  name: string;
  state: T;
  createdAt: string;
};

export type SavedViewsOptions<T> = {
  defaultViewName?: string;
  defaultViewState?: T;
};

type PersistedPayload<T> = {
  state: T;
  views: SavedView<T>[];
};

function isPersistedPayload<T>(value: unknown): value is PersistedPayload<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return "state" in value && "views" in value;
}

function loadPersisted<T>(key: string, fallbackState: T) {
  if (typeof window === "undefined") {
    return { state: fallbackState, views: [] as SavedView<T>[] };
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return { state: fallbackState, views: [] as SavedView<T>[] };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedPayload<T>(parsed)) {
      return { state: fallbackState, views: [] as SavedView<T>[] };
    }

    return {
      state: parsed.state ?? fallbackState,
      views: Array.isArray(parsed.views) ? parsed.views : [],
    };
  } catch {
    return { state: fallbackState, views: [] as SavedView<T>[] };
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSavedViews<T extends Record<string, unknown>>(
  storageKey: string,
  fallbackState: T,
  options?: SavedViewsOptions<T>
) {
  const fallbackRef = useRef(fallbackState);
  const defaultViewRef = useRef(options);
  const [state, setState] = useState<T>(fallbackState);
  const [views, setViews] = useState<SavedView<T>[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
    const { state: storedState, views: storedViews } = loadPersisted(
      storageKey,
      fallbackRef.current
    );
    const hasStoredPayload = raw !== null;
    const defaultView = defaultViewRef.current?.defaultViewName
      ? {
          id: `${storageKey}-default`,
          name: defaultViewRef.current.defaultViewName,
          state: defaultViewRef.current.defaultViewState ?? fallbackRef.current,
          createdAt: new Date().toISOString(),
        }
      : null;

    setState(storedState);
    setViews(
      !hasStoredPayload && defaultView ? [defaultView as SavedView<T>] : storedViews
    );
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    const payload: PersistedPayload<T> = { state, views };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [hydrated, state, storageKey, views]);

  const saveView = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setViews((current) => {
      const nextView: SavedView<T> = {
        id: createId(),
        name: trimmed,
        state,
        createdAt: new Date().toISOString(),
      };

      return [nextView, ...current.filter((view) => view.name !== trimmed)].slice(0, 8);
    });
  };

  const applyView = (viewId: string) => {
    const view = views.find((entry) => entry.id === viewId);
    if (!view) {
      return;
    }

    setState(view.state);
  };

  const deleteView = (viewId: string) => {
    setViews((current) => current.filter((view) => view.id !== viewId));
  };

  const resetState = () => setState(fallbackState);

  return {
    state,
    setState,
    views,
    saveView,
    applyView,
    deleteView,
    resetState,
  };
}
