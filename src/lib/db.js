import Database from 'better-sqlite3';
import path from 'path';

// O banco será salvo na raiz do projeto (fora de src)
const dbPath = path.resolve(process.cwd(), 'database.sqlite');

const db = new Database(dbPath, { 
    // verbose: console.log 
});

// Configurações p/ maior performance (Write-Ahead Logging)
db.pragma('journal_mode = WAL');

// Inicialização das tabelas se não existirem
const initDb = () => {
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

  // Semear dados padrão de colunas se estiver vazio
  const stmt = db.prepare('SELECT count(*) as count FROM columns');
  const { count } = stmt.get();
  
  if (count === 0) {
    const insertCol = db.prepare('INSERT INTO columns (id, title, sort_order) VALUES (?, ?, ?)');
    insertCol.run('col_leads', 'Leads', 1);
    insertCol.run('col_contato', 'Contato feito', 2);
    insertCol.run('col_proposta', 'Proposta', 3);
    insertCol.run('col_fechado', 'Fechado', 4);
  }
};

initDb();

export default db;
