import type { Metadata } from "next";
import { AdminPageHeader } from "../AdminPageHeader";
import { StoreSettings } from "../StoreSettings";

export const metadata: Metadata = {
  title: { absolute: "Shop Settings — Haley Wali" },
  description: "Manage delivery charges and the automatic storefront sale.",
};

export default function SettingsPage() {
  return (
    <main className="admin-page">
      <AdminPageHeader
        eyebrow="STORE MANAGER · SHOP SETTINGS"
        title="SHOP SETTINGS"
        description="Update delivery charges or control the automatic sale shown across the storefront and checkout."
      />
      <StoreSettings />
    </main>
  );
}
