import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UrPlaced — Multi-College Placement Preparation & Management SaaS",
    short_name: "UrPlaced",
    description:
      "Enterprise placement preparation and management platform connecting college placement operations with role-specific student skill mastery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#EDECE7",
    theme_color: "#5052C9",
    categories: ["education", "productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Student Portal",
        short_name: "Student",
        description: "Access your career profile, AI resume scanner, mock interviews and practice",
        url: "/dashboard/student",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Campus Drives",
        short_name: "Drives",
        description: "View and apply to active campus placement recruitment drives",
        url: "/dashboard/student/drives",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Mock Interview Studio",
        short_name: "Mock Interview",
        description: "Practice realistic campus placement interviews with voice input",
        url: "/dashboard/student/mock-interview",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
