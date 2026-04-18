import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.2bd3731fe76445f1b73302fd64bd00ad",
  appName: "SmartPrep",
  webDir: "dist",
  server: {
    url: "https://2bd3731f-e764-45f1-b733-02fd64bd00ad.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  android: {
    backgroundColor: "#ffffff",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
  },
};

export default config;
