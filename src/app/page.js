import { getColumns, getClients } from './actions';
import KanbanBoard from '@/components/KanbanBoard';

export const dynamic = 'force-dynamic'; // Sempre buscar do banco

export default async function Home() {
  const columns = await getColumns();
  const clients = await getClients();

  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <KanbanBoard initialColumns={columns} initialClients={clients} />
    </main>
  );
}
