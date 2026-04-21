'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { getData, saveData, STORAGE_TYPE } from '@/lib/storage';
import db from '@/lib/db'; // Mantemos para operações legadas ou locais rápidos

// Auxiliar para ler o estado atual
async function getCurrentState() {
  return await getData();
}

// Auxiliar para salvar o estado
async function updateState(newState) {
  await saveData(newState);
}

// -- COLUNAS -- //

export async function getColumns() {
  const state = await getCurrentState();
  return state.columns.sort((a, b) => a.sort_order - b.sort_order);
}

export async function saveColumn(id, title, sort_order) {
  const state = await getCurrentState();
  const finalId = id || randomUUID();
  
  const existingIdx = state.columns.findIndex(c => c.id === id);
  const newCol = { id: finalId, title, sort_order };

  if (existingIdx > -1) {
    state.columns[existingIdx] = newCol;
  } else {
    state.columns.push(newCol);
  }

  // No modo local, também espelhamos no SQLite para manter performance
  if (STORAGE_TYPE === 'local') {
    db.prepare(`
      INSERT INTO columns (id, title, sort_order) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, sort_order=excluded.sort_order
    `).run(finalId, title, sort_order);
  }

  await updateState(state);
  revalidatePath('/');
  return finalId;
}

export async function updateColumnsOrder(columnIds) {
  const state = await getCurrentState();
  state.columns = state.columns.map(col => {
    const idx = columnIds.indexOf(col.id);
    return { ...col, sort_order: idx + 1 };
  });

  if (STORAGE_TYPE === 'local') {
    const stmt = db.prepare('UPDATE columns SET sort_order = ? WHERE id = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index + 1, id));
    });
    transaction(columnIds);
  }

  await updateState(state);
  revalidatePath('/');
}

export async function deleteColumn(id) {
  const state = await getCurrentState();
  const firstCol = state.columns.find(c => c.id !== id);
  if (!firstCol) return;

  state.clients = state.clients.map(c => 
    c.column_id === id ? { ...c, column_id: firstCol.id, updated_at: Date.now() } : c
  );
  state.columns = state.columns.filter(c => c.id !== id);

  if (STORAGE_TYPE === 'local') {
    db.prepare('UPDATE clients SET column_id = ?, updated_at = ? WHERE column_id = ?').run(firstCol.id, Date.now(), id);
    db.prepare('DELETE FROM columns WHERE id = ?').run(id);
  }

  await updateState(state);
  revalidatePath('/');
}

// -- CLIENTES -- //

export async function getClients() {
  const state = await getCurrentState();
  return state.clients.sort((a, b) => b.updated_at - a.updated_at);
}

export async function saveClient(client) {
  const state = await getCurrentState();
  const finalId = client.id || randomUUID();
  client.id = finalId;
  client.updated_at = Date.now();
  client.created_at = client.created_at || Date.now();

  const idx = state.clients.findIndex(c => c.id === finalId);
  if (idx > -1) {
    state.clients[idx] = client;
  } else {
    state.clients.push(client);
  }

  if (STORAGE_TYPE === 'local') {
    db.prepare(`
      INSERT INTO clients (id, column_id, name, razao, doc, phone, address, obs, created_at, updated_at)
      VALUES (@id, @column_id, @name, @razao, @doc, @phone, @address, @obs, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET 
        column_id=excluded.column_id, name=excluded.name, razao=excluded.razao, doc=excluded.doc,
        phone=excluded.phone, address=excluded.address, obs=excluded.obs, updated_at=excluded.updated_at
    `).run(client);
  }

  await updateState(state);
  revalidatePath('/');
  return finalId;
}

export async function deleteClient(id) {
  const state = await getCurrentState();
  state.clients = state.clients.filter(c => c.id !== id);

  if (STORAGE_TYPE === 'local') {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  }

  await updateState(state);
  revalidatePath('/');
}

export async function moveClient(id, newColumnId) {
  const state = await getCurrentState();
  const idx = state.clients.findIndex(c => c.id === id);
  if (idx > -1) {
    state.clients[idx].column_id = newColumnId;
    state.clients[idx].updated_at = Date.now();
  }

  if (STORAGE_TYPE === 'local') {
    db.prepare('UPDATE clients SET column_id = ?, updated_at = ? WHERE id = ?').run(newColumnId, Date.now(), id);
  }

  await updateState(state);
  revalidatePath('/');
}

export async function syncBatch(columns, clients) {
  const state = await getCurrentState();
  
  // Mapeamento de IDs
  const colMap = new Map();
  columns.forEach(c => {
    const origId = c.id;
    c.id = c.id && !c.id.startsWith('id_') ? c.id : randomUUID();
    colMap.set(origId, c.id);
    
    const idx = state.columns.findIndex(x => x.id === c.id);
    if (idx > -1) state.columns[idx] = c; else state.columns.push(c);
  });

  clients.forEach(cli => {
    cli.id = cli.id && !cli.id.startsWith('id_') ? cli.id : randomUUID();
    if (colMap.has(cli.column_id)) cli.column_id = colMap.get(cli.column_id);
    
    const idx = state.clients.findIndex(x => x.id === cli.id);
    if (idx > -1) state.clients[idx] = cli; else state.clients.push(cli);
  });

  if (STORAGE_TYPE === 'local') {
    // Para simplificar no modo local mantemos a transaction original 
    // mas isso é redundante se já salvamos no JSON. 
    // Vamos apenas rodar o updateState que salva no JSON e o SQLite se vira no próximo restart se precisarmos.
  }

  await updateState(state);
  revalidatePath('/');
}
