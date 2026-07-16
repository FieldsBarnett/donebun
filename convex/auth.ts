import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth";
import { crossDomain, convex } from "@convex-dev/better-auth/plugins";
import { Resend } from "resend";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

let resendClient: Resend | undefined;

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

const trustedOrigins = [
  "https://donebun.app",
  "https://www.donebun.app",
];

if (process.env.SITE_URL && !trustedOrigins.includes(process.env.SITE_URL)) {
  trustedOrigins.push(process.env.SITE_URL);
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    plugins: [
      crossDomain({ siteUrl: process.env.SITE_URL || trustedOrigins[0] }),
      convex({ authConfig })
    ],
    emailAndPassword: {
      enabled: true,
      async sendVerificationEmail({ user, url }: { user: any; url: string }) {
        await getResend().emails.send({
          from: "onboarding@donebun.app",
          to: user.email,
          subject: "Verify your email - DoneBun",
          html: `<a href="${url}">Click here to verify your email</a>`,
        });
      },
      async sendResetPassword({ user, url }: { user: any; url: string }) {
        await getResend().emails.send({
          from: "onboarding@donebun.app",
          to: user.email,
          subject: "Reset your password - DoneBun",
          html: `<a href="${url}">Click here to reset your password</a>`,
        });
      }
    },
  });
};
