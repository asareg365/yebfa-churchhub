"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useUser, useFirestore } from "@/firebase";
import {
  collection,
  limit,
  query,
  where,
} from "firebase/firestore";
import { useCollection } from "@/firebase";

const SUPER_ADMINS = [
  "asareg365@gmail.com",
  "frankyeb@gmail.com",
];

type TenantContextType = {
  currentChurch: any | null;
  loading: boolean;
  isSuperAdmin: boolean;
  selectedTenantSlug: string | null;
};

const TenantContext = createContext<TenantContextType>({
  currentChurch: null,
  loading: true,
  isSuperAdmin: false,
  selectedTenantSlug: null,
});

export function TenantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: userLoading } = useUser();
  const db = useFirestore();

  const [mounted, setMounted] = useState(false);
  const [selectedTenantSlug, setSelectedTenantSlug] =
    useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const saved = localStorage.getItem(
      "global_admin_selected_tenant"
    );

    if (saved) {
      setSelectedTenantSlug(saved.toLowerCase().trim());
    }
  }, []);

  const isSuperAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase().trim();

    return !!email && SUPER_ADMINS.includes(email);
  }, [user?.email]);

  const churchQuery = useMemo(() => {
    if (!mounted || !user?.email || !db) {
      return null;
    }

    const normalizedEmail = user.email
      .toLowerCase()
      .trim();

    /*
     * SUPER ADMIN
     *
     * Strictly use the tenant selected in the System Switcher.
     * Never fall back to adminEmails list for Super Admins.
     */
    if (isSuperAdmin) {
      if (!selectedTenantSlug) {
        return null;
      }

      return query(
        collection(db, "churches"),
        where(
          "slug",
          "==",
          selectedTenantSlug.toLowerCase().trim()
        ),
        limit(1)
      );
    }

    /*
     * NORMAL CHURCH USER
     *
     * Find the church where the user is authorized.
     */
    return query(
      collection(db, "churches"),
      where(
        "adminEmails",
        "array-contains",
        normalizedEmail
      ),
      limit(1)
    );
  }, [
    db,
    user?.email,
    isSuperAdmin,
    selectedTenantSlug,
    mounted,
  ]);

  const {
    data: churches,
    loading: churchLoading,
  } = useCollection(churchQuery);

  const currentChurch = churches?.[0] || null;

  return (
    <TenantContext.Provider
      value={{
        currentChurch,
        loading:
          !mounted ||
          userLoading ||
          churchLoading,
        isSuperAdmin,
        selectedTenantSlug,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
