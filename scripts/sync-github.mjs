#!/usr/bin/env node
/**
 * Watches for new git commits and auto-pushes to GitHub.
 * Runs as a persistent background workflow in Replit.
 * Reads GITHUB_TOKEN and GITHUB_USERNAME from environment variables.
 */
import { watch } from "fs";
import { execSync } from "child_process";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USERNAME || "dkazimee";
const repo = "chassii";
const COMMIT_MSG_FILE = "/home/runner/workspace/.git/COMMIT_EDITMSG";

if (!token) {
  console.error("[sync-github] GITHUB_TOKEN not set. Exiting.");
  process.exit(1);
}

const remote = `https://${username}:${token}@github.com/${username}/${repo}.git`;

let pushing = false;
let pendingPush = false;

async function pushToGitHub() {
  if (pushing) {
    pendingPush = true;
    return;
  }
  pushing = true;
  try {
    console.log("[sync-github] Pushing to GitHub...");
    execSync(`git push "${remote}" main 2>&1`, { stdio: "pipe" });
    console.log("[sync-github] Pushed successfully.");
  } catch (err) {
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    console.error("[sync-github] Push failed:", output);
  } finally {
    pushing = false;
    if (pendingPush) {
      pendingPush = false;
      // small delay to let any in-flight changes settle
      setTimeout(pushToGitHub, 2000);
    }
  }
}

console.log("[sync-github] Watching for new commits...");

// COMMIT_EDITMSG is updated every time a commit is made
watch(COMMIT_MSG_FILE, () => {
  // Small delay to ensure the commit is fully written
  setTimeout(pushToGitHub, 1000);
});
