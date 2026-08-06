/**
 * Gmail send integration -- lets the operator connect their own Gmail account (OAuth,
 * gmail.send scope only) and send an outreach draft with one click instead of copy/pasting
 * into Gmail by hand. Single-operator system, so there's exactly one connected account at a
 * time; a fresh connect just inserts a new gmail_tokens row (see repo.ts for why).
 *
 * Deliberately NOT wired into any autonomous/scheduled path -- every send in this app is
 * triggered by an explicit click on a specific draft the operator has already read. Nothing
 * here decides on its own that a message is ready to go.
 */
import { google } from "googleapis";
import { latestGmailToken, saveGmailToken } from "../db/repo.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/userinfo.email"];

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function buildOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthUrl(redirectUri: string): string {
  const client = buildOAuthClient(redirectUri);
  // access_type: offline + prompt: consent -- without both, Google won't reliably hand back a
  // refresh_token on repeat authorizations, and without one the connection dies the moment the
  // short-lived access token expires (about an hour).
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleOAuthCallback(code: string, redirectUri: string): Promise<string> {
  const client = buildOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email ?? "unknown";

  await saveGmailToken({
    email,
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
  });
  return email;
}

async function getAuthenticatedClient() {
  const token = await latestGmailToken();
  if (!token || !token.refresh_token) {
    throw new Error("Gmail is not connected -- connect an account first.");
  }
  const client = buildOAuthClient(process.env.GOOGLE_REDIRECT_URI || "");
  client.setCredentials({
    access_token: token.access_token ?? undefined,
    refresh_token: token.refresh_token,
    expiry_date: token.token_expiry ? new Date(token.token_expiry).getTime() : undefined,
  });
  // googleapis transparently refreshes the access token using the refresh_token when it's
  // expired -- persist the refreshed one so the next send doesn't pay for another refresh
  // round-trip. Fall back to the existing refresh_token since Google only returns a new one
  // on rare rotation, not on every refresh.
  client.on("tokens", (newTokens) => {
    if (newTokens.access_token) {
      saveGmailToken({
        email: token.email,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token ?? token.refresh_token,
        expiryDate: newTokens.expiry_date ?? null,
      }).catch(() => {});
    }
  });
  return { client, fromEmail: token.email as string };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { client, fromEmail } = await getAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth: client });
  const from = input.fromName ? `${input.fromName} <${fromEmail}>` : fromEmail;

  const messageLines = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ];
  const raw = Buffer.from(messageLines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

function encodeSubject(subject: string): string {
  // RFC 2047 encoding -- harmless for plain ASCII subjects, keeps anything with an em-dash or
  // curly quote from getting mangled by mail clients that don't assume UTF-8.
  return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
}
