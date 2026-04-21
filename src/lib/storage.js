import db from './db'; // SQLite (Condicional)
import fs from 'fs';
import path from 'path';

/**
 * Esse arquivo decide qual motor de banco de dados usar.
 * Prioridade total para o GitHub se o Token estiver presente ou se estivermos na Vercel.
 */

const isCloud = process.env.VERCEL || process.env.NODE_ENV === 'production';
const STORAGE_TYPE = (process.env.GITHUB_TOKEN || isCloud) ? 'github' : 'local';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const DB_PATH = 'data/database.json';

let lastSha = null;

async function getGitHubData() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error("Configuração ausente: GITHUB_TOKEN e GITHUB_REPO são obrigatórios para rodar na nuvem.");
  }

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
    throw new Error(`Erro API GitHub (${res.status}): Verifique o Token e o Nome do Repositório.`);
  }

  const json = await res.json();
  lastSha = json.sha;
  const content = Buffer.from(json.content, 'base64').toString('utf-8');
  return JSON.parse(content);
}

async function saveGitHubData(data) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) throw new Error("Configuração ausente para salvar no GitHub.");

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

export async function getData() {
  if (STORAGE_TYPE === 'github') {
    return await getGitHubData();
  } else {
    if (!db) return { columns: [], clients: [] };
    const columns = db.prepare('SELECT * FROM columns ORDER BY sort_order ASC').all();
    const clients = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all();
    return { columns, clients };
  }
}

export async function saveData(data) {
  if (STORAGE_TYPE === 'github') {
    return await saveGitHubData(data);
  } else {
    const jsonPath = path.resolve(process.cwd(), DB_PATH);
    if (!fs.existsSync(path.dirname(jsonPath))) {
      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    
    if (db) {
       // Opcional: Manter SQLite atualizado se quiser, mas o JSON acima já resolve localmente.
    }
    return true;
  }
}

export { STORAGE_TYPE };
