import fs from "fs";
import path from "path";
import { getSession } from "./_lib/auth.js";

function readPromptFile(relativePath) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "prompts", relativePath), "utf-8");
  } catch {
    return "";
  }
}

function buildSystemPrompt(clientId, clientName, industry, contextBlock) {
  const general = readPromptFile("general-neuma.md");
  const clientSkill = clientId ? readPromptFile(`clients/${clientId}.md`) : "";
  const cliente = clientName ? `\n\nCLIENTE: ${clientName}${industry ? ` (${industry})` : ""}\n${contextBlock || ""}` : "";
  return [general, clientSkill].filter(Boolean).join("\n\n") + cliente;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "no_session" });

  const { model, max_tokens, messages, clientId, clientName, industry, contextBlock } = req.body || {};
  const system = buildSystemPrompt(clientId, clientName, industry, contextBlock);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, system, messages }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
