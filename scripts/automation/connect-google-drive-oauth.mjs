import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "http://127.0.0.1:8765/api/google/oauth/callback";
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET.");
if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

const callbackUrl = new URL(redirectUri);
const state = randomUUID();
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", redirectUri);
    if (requestUrl.pathname !== callbackUrl.pathname) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");
    if (!code || returnedState !== state) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Invalid Google OAuth callback.");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    const existing = await readExistingToken();
    const mergedTokens = { ...existing, ...tokens };
    if (!tokens.refresh_token && existing.refresh_token) mergedTokens.refresh_token = existing.refresh_token;
    await saveToken(mergedTokens);

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>Google Drive Connected</h1><p>You can close this tab and return to Codex.</p>");
    console.log("Google Drive OAuth token saved to Supabase.");
    server.close();
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Google Drive OAuth failed.");
    console.error(`Google Drive OAuth failed: ${error.message}`);
    server.close(() => process.exit(1));
  }
});

server.listen(Number(callbackUrl.port || 80), callbackUrl.hostname, () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    state,
    scope: ["https://www.googleapis.com/auth/drive"]
  });
  console.log("Opening Google OAuth consent in your browser...");
  console.log(authUrl);
  openUrl(authUrl);
});

async function readExistingToken() {
  const { data, error } = await supabase
    .from("integration_tokens")
    .select("token_json")
    .eq("id", "google_drive")
    .maybeSingle();
  if (error) throw error;
  return data?.token_json || {};
}

async function saveToken(tokenJson) {
  const { error } = await supabase.from("integration_tokens").upsert(
    {
      id: "google_drive",
      provider: "google",
      token_json: tokenJson,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

function openUrl(url) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(command, args, (error) => {
    if (error) console.log("Open the URL above manually if the browser did not open.");
  });
}
