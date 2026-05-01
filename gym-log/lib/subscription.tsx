import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { UpgradeProModal } from "@/components/UpgradeProModal";

/**
 * Unified subscription state for the app.
 *
 * Two tiers only:
 *   - Free  (isPro = false, default)
 *   - Pro   (isPro = true)
 *
 * Free users see only the last 14 days of workouts and are locked out of
 * AI Workout Suggestion, the Coach tab, and Progress Photo analysis.
 * Pro users get full unlock.
 *
 * --------------------------------------------------------------------------
 * Future Stripe / Apple / RevenueCat integration:
 *
 * The `setPro()` setter is the single mutation point for entitlement state.
 * When real billing is wired up, route the entitlement webhook (Stripe
 * subscription.updated, Apple S2S notification, RevenueCat customer info,
 * etc.) through `setProFromBilling()` below. That seam keeps every UI
 * gating decision identical — only the source of truth changes.
 *
 * The current `setPro()` is a self-attested local toggle. Replace the body
 * of `setProFromBilling` with a server-verified entitlement read (signed
 * token / authenticated /me/entitlements call) before treating Pro as
 * paid in production.
 * --------------------------------------------------------------------------
 */

const STORAGE_KEY = "gymlog.subscription.v1";

type StoredState = {
  isPro: boolean;
  updatedAt: number;
};

type Ctx = {
  ready: boolean;
  isPro: boolean;
  /** Set Pro state directly. Local-only mutation (test/dev path). */
  setPro: (next: boolean) => Promise<void>;
  /**
   * Single seam where a future billing webhook should land.
   * Currently identical to setPro; swap for server-verified entitlement
   * once Stripe / Apple / RevenueCat is wired up.
   */
  setProFromBilling: (next: boolean) => Promise<void>;
  /** Imperatively show the upgrade modal. */
  showUpgradePrompt: () => void;
  /**
   * Returns true if Pro. Otherwise opens the upgrade modal and returns false.
   * Use as a one-line gate at the top of any locked feature handler.
   */
  requireProOrPrompt: () => boolean;
};

const SubscriptionContext = createContext<Ctx | null>(null);

function defaultState(): StoredState {
  return { isPro: false, updatedAt: 0 };
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<StoredState>(defaultState);
  const [modalVisible, setModalVisible] = useState(false);

  // Hydrate from storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<StoredState> | null;
          if (parsed && typeof parsed === "object") {
            setState({
              isPro: parsed.isPro === true,
              updatedAt:
                typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
            });
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after hydration only.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [ready, state]);

  const setPro = useCallback(async (next: boolean) => {
    setState({ isPro: next, updatedAt: Date.now() });
    if (next) setModalVisible(false);
  }, []);

  // Stripe/Apple webhook seam. Today: same as setPro. Tomorrow: replace body
  // with verified entitlement check.
  const setProFromBilling = useCallback(
    async (next: boolean) => {
      await setPro(next);
    },
    [setPro],
  );

  const showUpgradePrompt = useCallback(() => {
    setModalVisible(true);
  }, []);

  const requireProOrPrompt = useCallback((): boolean => {
    if (state.isPro) return true;
    setModalVisible(true);
    return false;
  }, [state.isPro]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      isPro: state.isPro,
      setPro,
      setProFromBilling,
      showUpgradePrompt,
      requireProOrPrompt,
    }),
    [
      ready,
      state.isPro,
      setPro,
      setProFromBilling,
      showUpgradePrompt,
      requireProOrPrompt,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <UpgradeProModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onUpgrade={async () => {
          await setPro(true);
        }}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): Ctx {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscription must be used inside SubscriptionProvider",
    );
  }
  return ctx;
}

export const FREE_HISTORY_DAYS = 14;
