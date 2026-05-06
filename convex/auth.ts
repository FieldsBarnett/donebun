import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { betterAuth } from "better-auth";
import { crossDomain, convex } from "@convex-dev/better-auth/plugins";
import { Resend } from "resend";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

const resend = new Resend(process.env.RESEND_API_KEY);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
    database: authComponent.adapter(ctx),
    plugins: [
      crossDomain({ siteUrl: process.env.SITE_URL! }),
      convex({ authConfig })
    ],
    emailAndPassword: {
      enabled: true,
      async sendVerificationEmail({ user, url }: { user: any; url: string }) {
        await resend.emails.send({
          from: "onboarding@donebun.app",
          to: user.email,
          subject: "Verify your email - DoneBun",
          html: `<a href="${url}">Click here to verify your email</a>`,
        });
      },
      async sendResetPassword({ user, url }: { user: any; url: string }) {
        await resend.emails.send({
          from: "onboarding@donebun.app",
          to: user.email,
          subject: "Reset your password - DoneBun",
          html: `<a href="${url}">Click here to reset your password</a>`,
        });
      }
    },
  });
};
