import db from './db'; // SQLite (Local)
import fs from 'fs';
import path from 'path';

/**
 * Esse arquivo decide qual motor de banco de dados usar.
 * Se houver um GITHUB_TOKEN nas variáveis de ambiente, ele usará a API do GitHub.
 * Caso contrário, usará o SQLite local.
 */

const STORAGE_TYPE = process.env.GITHUB_TOKEN ? 'github' : 'local';

// -- CONFIGURAÇÕES GITHUB -- //
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // ex: "usuario/repositorio"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const DB_PATH = 'data/database.json';

// Cache para evitar múltiplos fetches do SHA no GitHub
let lastSha = null;

async function getGitHubData() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DB_PATH}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    if (res.status === 404) return { columns: [], clients: [] };
    throw new Error(`Erro ao buscar dados do GitHub: ${res.statusText}`);
  }

  const json = await res.json();
  lastSha = json.sha;
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  return JSON.parse(content);
}

async function saveGitHubData(data) {
  // Primeiro pegamos o SHA atual (necessário para update no GitHub)
  if (!lastSha) {
    const urlGet = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DB_PATH}?ref=${GITHUB_BRANCH}`;
    const resGet = await fetch(urlGet, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
      cache: 'no-store'
    });
    if (resGet.ok) {
      const jsonGet = await resGet.json();
      lastSha = jsonGet.sha;
    }
  }

  const urlPut = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DB_PATH}`;
  const body = {
    message: `CRM Update: ${new Date().toISOString()}`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    sha: lastSha,
    branch: GITHUB_BRANCH
  };

  const res = await fetch(urlPut, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Erro ao salvar no GitHub: ${err.message}`);
  }

  const resJson = await res.json();
  lastSha = resJson.content.sha;
  return true;
}

// -- INTERFACE UNIFICADA -- //

export async function getData() {
  if (STORAGE_TYPE === 'github') {
    return await getGitHubData();
  } else {
    // Para simplificar a transição, o GET no local pode continuar usando SQLite 
    // ou ler do JSON. Vamos usar o SQLite que já está pronto.
    const columns = db.prepare('SELECT * FROM columns ORDER BY sort_order ASC').all();
    const clients = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all();
    return { columns, clients };
  }
}

export async function saveData(data) {
  if (STORAGE_TYPE === 'github') {
    return await saveGitHubData(data);
  } else {
    // No modo local, o SQLite já é persistente. 
    // Mas para manter compatibilidade com o formato JSON da nuvem, 
    // poderíamos salvar um backup em JSON aqui também.
    const jsonPath = path.resolve(process.cwd(), DB_PATH);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    return true;
  }
}

export { STORAGE_TYPE };
