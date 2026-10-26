/**
 * Domain Module: Notification Center & Email Adapter
 * Scope: In-app real-time notifications, persistence, delivery status, read management.
 */

export * from "./types";
export * from "./services/notification-service";
export * from "./hooks/use-notifications";

export const NotificationsModule = {
  name: "notifications",
  status: "active",
  version: "1.0.0",
} as const;
