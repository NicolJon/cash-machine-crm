// Somente carregamos o SQLite se não estivermos na Vercel ou em produção cloud
// Vercel não suporta gravação em disco local e módulos nativos como better-sqlite3 podem falhar.
const isCloud = process.env.VERCEL || process.env.NODE_ENV === 'production';

let db = null;

if (!isCloud) {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.resolve(process.cwd(), 'database.sqlite');
    
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        name TEXT NOT NULL,
        razao TEXT,
        doc TEXT,
        phone TEXT,
        address TEXT,
        obs TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(column_id) REFERENCES columns(id)
      );
    `);

    const { count } = db.prepare('SELECT count(*) as count FROM columns').get();
    if (count === 0) {
      const insertCol = db.prepare('INSERT INTO columns (id, title, sort_order) VALUES (?, ?, ?)');
      insertCol.run('col_leads', 'Leads', 1);
      insertCol.run('col_contato', 'Contato feito', 2);
      insertCol.run('col_proposta', 'Proposta', 3);
      insertCol.run('col_fechado', 'Fechado', 4);
    }
  } catch (e) {
    console.error("Erro ao inicializar SQLite local:", e);
  }
}

export default db;
