import type { AppContext } from "./appContext";

const WHATSAPP_NUMBER = "40766338046";
const PLATFORM_LABELS: Record<string, string> = { android: "Android", ios: "iOS", macos: "macOS", windows: "Windows", linux: "Linux" };

/**
 * WhatsApp with a greeting typed in. From the app, the greeting starts with the
 * same tag the app's own WhatsApp button used, so support still sees the
 * platform, version and device the message came from.
 */
export function whatsappUrl(context: AppContext): string {
  const { platform = "", app_version, device_id = "" } = context;
  const message =
    context.source === "app"
      ? `[RadioCrestin/${PLATFORM_LABELS[platform] ?? platform}/v${app_version ?? ""}/${device_id}]\n\nBuna ziua,\n`
      : "Buna ziua [radiocrestin.ro]\n";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const PRIVACY_URL = "/privacy-policy/";
