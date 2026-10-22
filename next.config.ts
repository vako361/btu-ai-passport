import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Webhook-ის გვირაბის ნებართვა ახალი ლინკით
 
  allowedDevOrigins: ["1cbf9addba4270.lhr.life"],

  // Turbopack-ის სტილების კონფიგურაცია
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withPayload(nextConfig);