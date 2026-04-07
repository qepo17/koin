import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settings } from "../lib/api";

interface PrivacyContextType {
  privacyMode: boolean;
  isLoading: boolean;
  togglePrivacy: () => void;
  setPrivacy: (enabled: boolean) => void;
  revealValue: (key: string) => void;
  hideValue: (key: string) => void;
  isRevealed: (key: string) => boolean;
}

const PrivacyContext = createContext<PrivacyContextType | null>(null);

// Session-only reveal state - not persisted
const revealedKeys = new Set<string>();

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const { data: userSettings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await settings.get();
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const privacyMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await settings.setPrivacy(enabled);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const privacyMode = userSettings?.privacyMode ?? false;

  const togglePrivacy = useCallback(() => {
    privacyMutation.mutate(!privacyMode);
  }, [privacyMode, privacyMutation]);

  const setPrivacy = useCallback(
    (enabled: boolean) => {
      privacyMutation.mutate(enabled);
    },
    [privacyMutation]
  );

  const revealValue = useCallback((key: string) => {
    revealedKeys.add(key);
    setRevealed(new Set(revealedKeys));
  }, []);

  const hideValue = useCallback((key: string) => {
    revealedKeys.delete(key);
    setRevealed(new Set(revealedKeys));
  }, []);

  const isRevealed = useCallback(
    (key: string) => {
      return revealed.has(key);
    },
    [revealed]
  );

  return (
    <PrivacyContext.Provider
      value={{
        privacyMode,
        isLoading,
        togglePrivacy,
        setPrivacy,
        revealValue,
        hideValue,
        isRevealed,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error("usePrivacy must be used within a PrivacyProvider");
  }
  return context;
}
