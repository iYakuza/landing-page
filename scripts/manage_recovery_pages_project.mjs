#!/usr/bin/env node
import process from "node:process";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "4372415f32c41cddd51893eac634c0b7";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const PROJECT_NAME = "green-dream-recovery-preview";
const PRODUCTION_BRANCH = "recovery-drill-preview";
const API_ROOT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;

if (!API_TOKEN) {
  console.error("Missing the CLOUDFLARE_API_TOKEN GitHub Actions secret.");
  process.exit(1);
}

async function api(method, path, body, query) {
  const url = new URL(API_ROOT + path);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Cloudflare returned a non-JSON response for ${method} ${path} (HTTP ${response.status}).`);
  }
  if (!response.ok || payload.success !== true) {
    const first = payload.errors?.[0] || {};
    const error = new Error(first.message || `Cloudflare API request failed: ${method} ${path} (HTTP ${response.status}).`);
    error.status = response.status;
    error.apiCode = first.code;
    throw error;
  }
  return payload;
}

async function getProject() {
  try {
    const response = await api("GET", `/pages/projects/${PROJECT_NAME}`);
    return response.result;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function assertDirectUploadProject(project) {
  if (project.name !== PROJECT_NAME || project.production_branch !== PRODUCTION_BRANCH) {
    throw new Error("The existing Pages project does not match the approved recovery project identity; refusing to use it.");
  }
  if (project.source?.type || project.source?.config) {
    throw new Error("The recovery Pages project has a Git source connection. Refusing to deploy or delete a Git-connected project.");
  }
}

async function ensureProject() {
  let project = await getProject();
  if (project) {
    assertDirectUploadProject(project);
    console.log("The owner-created Direct Upload recovery project already exists; no duplicate will be created.");
    return;
  }
  const created = await api("POST", "/pages/projects", {
    name: PROJECT_NAME,
    production_branch: PRODUCTION_BRANCH,
  });
  project = created.result;
  assertDirectUploadProject(project);
  console.log("Created the Direct Upload recovery project on explicit owner request.");
}

async function removeProject() {
  const project = await getProject();
  if (!project) {
    console.log("No recovery Pages project exists. Nothing to remove.");
    return;
  }
  assertDirectUploadProject(project);

  const first = await api("GET", `/pages/projects/${PROJECT_NAME}/deployments`, undefined, { page: 1, per_page: 25 });
  const totalPages = Number(first.result_info?.total_pages || 1);
  let deleted = 0;
  let protectedProduction = 0;

  // Delete highest page numbers first so pagination remains stable as rows are removed.
  for (let page = totalPages; page >= 1; page--) {
    const listing = page === 1 ? first : await api("GET", `/pages/projects/${PROJECT_NAME}/deployments`, undefined, { page, per_page: 25 });
    for (const deployment of listing.result || []) {
      try {
        await api("DELETE", `/pages/projects/${PROJECT_NAME}/deployments/${deployment.id}`, undefined, { force: true });
        deleted++;
      } catch (error) {
        if (error.apiCode === 8000034) {
          protectedProduction++;
          continue;
        }
        throw error;
      }
    }
  }

  // Cloudflare protects the active production deployment from individual deletion.
  // Deleting the project after removing its deployment history removes that final deployment.
  await api("DELETE", `/pages/projects/${PROJECT_NAME}`);
  console.log(`Removed the recovery Pages project. Deleted ${deleted} deployment records; active production was protected individually: ${protectedProduction}.`);
}

const operation = process.argv[2];
try {
  if (operation === "ensure") await ensureProject();
  else if (operation === "remove") await removeProject();
  else throw new Error("Usage: node scripts/manage_recovery_pages_project.mjs ensure|remove");
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
