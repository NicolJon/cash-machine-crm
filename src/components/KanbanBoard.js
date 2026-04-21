'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { 
  Search, Plus, Download, Upload, Moon, Sun, LayoutDashboard, FileSpreadsheet
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { saveClient, deleteClient, moveClient, syncBatch, saveColumn, deleteColumn, updateColumnsOrder } from '@/app/actions';
import * as XLSX from 'xlsx';

import './KanbanBoard.css';

const uid = () => 'id_' + Math.random().toString(36).substr(2, 9);

function SortableColumn({ column, children, onEdit, onDelete }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'Column', column }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <section 
      ref={setNodeRef} 
      className="column" 
      style={style}
    >
      <div className="column-header" {...attributes} {...listeners} style={{cursor: 'grab'}}>
        <div className="column-title-wrap">
          <div className="column-title">{column.title}</div>
          <div className="column-count">{React.Children.count(children) || 0} clientes</div>
        </div>
        <div className="column-actions">
          <button className="btn icon-only ghost" title="Editar coluna" onPointerDown={e=>e.stopPropagation()} onClick={() => onEdit(column)}><Search size={16} /></button>
          <button className="btn icon-only danger ghost" title="Deletar" onPointerDown={e=>e.stopPropagation()} onClick={() => onDelete(column)}><Plus style={{transform: 'rotate(45deg)'}} size={16} /></button>
        </div>
      </div>
      <div className="cards-container">
        {children}
      </div>
    </section>
  );
}

function DraggableCard({ client, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
    data: { type: 'Card', client }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 99 : 1,
  } : undefined;

  const initials = client.name ? client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const dateStr = client.updated_at ? new Date(client.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

  return (
    <article 
      ref={setNodeRef} 
      style={style}
      {...listeners} 
      {...attributes}
      className={`card ${isDragging ? 'dragging' : ''}`}
      onDoubleClick={() => onClick(client)}
    >
      <div className="card-header">
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          <div className="card-avatar">{initials}</div>
          <div>
            <div className="card-name">{client.name || '(Sem nome)'}</div>
            <div style={{fontSize: '11px', color: 'var(--muted)'}}>Atualizado em {dateStr}</div>
          </div>
        </div>
      </div>
      <div className="card-meta">
        {client.razao && <div><b>Empresa:</b> {client.razao}</div>}
        {client.phone && <div><b>Tel:</b> {client.phone}</div>}
        {client.doc && <div className="card-doc-badge" style={{marginTop: '4px', width: 'fit-content'}}>{client.doc}</div>}
      </div>
    </article>
  );
}

export default function KanbanBoard({ initialColumns, initialClients }) {
  const { theme, toggleTheme } = useTheme();
  
  const [columns, setColumns] = useState(initialColumns);
  const [clients, setClients] = useState(initialClients);
  
  const [activeCard, setActiveCard] = useState(null);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isClientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [isColModalOpen, setColModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Computed
  const filteredClients = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(c => 
      (c.name||'').toLowerCase().includes(q) ||
      (c.razao||'').toLowerCase().includes(q) ||
      (c.doc||'').toLowerCase().includes(q) ||
      (c.phone||'').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const stats = useMemo(() => {
    const map = {};
    columns.forEach(c => map[c.title] = 0);
    clients.forEach(c => {
      const col = columns.find(x => x.id === c.column_id);
      if (col) map[col.title]++;
    });
    return map;
  }, [columns, clients]);

  // Drag Handlers
  const [activeColumn, setActiveColumn] = useState(null);

  const handleDragStart = (event) => {
    const { active } = event;
    if (active.data.current?.type === 'Card') {
      setActiveCard(active.data.current.client);
    }
    if (active.data.current?.type === 'Column') {
      setActiveColumn(active.data.current.column);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;
    
    // Drop over a column for cards
    if (active.data.current?.type === 'Card') {
      let overId = over.id; 
      // If dropped over a card, get its column
      if (over.data.current?.type === 'Card') {
         overId = over.data.current.client.column_id;
      }
      const activeClient = active.data.current?.client;

      if (activeClient && activeClient.column_id !== overId) {
        setClients(prev => prev.map(c => c.id === activeClient.id ? { ...c, column_id: overId, updated_at: Date.now() } : c));
        await moveClient(activeClient.id, overId);
      }
    }

    // Drop over a column for columns
    if (active.data.current?.type === 'Column') {
      const overId = over.id;
      if (active.id !== overId) {
        setColumns(columns => {
          const oldIndex = columns.findIndex(col => col.id === active.id);
          const newIndex = columns.findIndex(col => col.id === overId);
          const newCols = arrayMove(columns, oldIndex, newIndex);
          updateColumnsOrder(newCols.map(c => c.id));
          return newCols;
        });
      }
    }
  };

  // Client CRUD UI
  const handleSaveClient = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      id: editingClient?.id || uid(),
      column_id: fd.get('column_id'),
      name: fd.get('name'),
      razao: fd.get('razao'),
      doc: fd.get('doc'),
      phone: fd.get('phone'),
      address: fd.get('address'),
      obs: fd.get('obs'),
      created_at: editingClient?.created_at || Date.now(),
      updated_at: Date.now()
    };
    
    // optimistic
    const finalData = { ...data };
    if (!editingClient) finalData.id = uid();

    if (editingClient) {
      setClients(prev => prev.map(c => c.id === data.id ? finalData : c));
    } else {
      setClients(prev => [finalData, ...prev]);
    }
    
    setClientModalOpen(false);
    const realId = await saveClient(finalData);
    if (!editingClient) {
      setClients(prev => prev.map(c => c.id === finalData.id ? { ...c, id: realId } : c));
    }
  };

  const handleDeleteClient = async () => {
    if (!editingClient) return;
    if (!confirm('Excluir este cliente?')) return;
    setClients(prev => prev.filter(c => c.id !== editingClient.id));
    setClientModalOpen(false);
    await deleteClient(editingClient.id);
  };

  // Column CRUD UI
  const handleSaveCol = async (e) => {
    e.preventDefault();
    const title = new FormData(e.target).get('title');
    const data = {
      id: editingCol?.id || uid(),
      title,
      sort_order: editingCol?.sort_order || columns.length + 1
    };
    const finalData = { ...data };
    if (!editingCol) finalData.id = uid();

    if (editingCol) {
      setColumns(prev => prev.map(c => c.id === data.id ? finalData : c));
    } else {
      setColumns(prev => [...prev, finalData]);
    }
    setColModalOpen(false);
    const realId = await saveColumn(finalData.id, finalData.title, finalData.sort_order);
    if (!editingCol) {
      setColumns(prev => prev.map(c => c.id === finalData.id ? { ...c, id: realId } : c));
    }
  };

  const handleDeleteCol = async () => {
    if (!editingCol) return;
    if (columns.length === 1) return alert("É preciso ao menos 1 coluna.");
    if (!confirm('Excluir esta coluna? Os cards voltarão para a primeira.')) return;
    
    const firstCol = columns.find(c => c.id !== editingCol.id);
    
    setColumns(prev => prev.filter(c => c.id !== editingCol.id));
    setClients(prev => prev.map(c => c.column_id === editingCol.id ? {...c, column_id: firstCol.id} : c));
    
    setColModalOpen(false);
    await deleteColumn(editingCol.id);
  };

  // Excel
  const fileInputRef = React.useRef(null);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const wsCols = XLSX.utils.json_to_sheet(columns);
    XLSX.utils.book_append_sheet(wb, wsCols, "Colunas");

    const exportClients = clients.map(c => ({
      ...c,
      coluna: columns.find(x => x.id === c.column_id)?.title || ''
    }));
    const wsCli = XLSX.utils.json_to_sheet(exportClients);
    XLSX.utils.book_append_sheet(wb, wsCli, "Clientes");

    XLSX.writeFile(wb, `crm_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const wsCols = XLSX.utils.json_to_sheet([{ id: '', titulo: 'Etapa 1', ordem: 1 }]);
    XLSX.utils.book_append_sheet(wb, wsCols, "Colunas");

    const wsCli = XLSX.utils.json_to_sheet([{
      colunaId: '',
      coluna: 'Etapa 1',
      nome: 'Exemplo',
      razaoSocial: '',
      cpfCnpj: '',
      telefone: '',
      endereco: '',
      observacao: ''
    }]);
    XLSX.utils.book_append_sheet(wb, wsCli, "Clientes");

    XLSX.writeFile(wb, `modelo_import_crm.xlsx`);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: "array" });
        
        let importedCols = XLSX.utils.sheet_to_json(wb.Sheets["Colunas"] || wb.Sheets[wb.SheetNames[0]]) || [];
        let importedClients = XLSX.utils.sheet_to_json(wb.Sheets["Clientes"] || wb.Sheets[wb.SheetNames[1]]) || [];
        
        if (importedCols.length === 0 && importedClients.length === 0) return alert('Planilha vazia ou formato inválido');
        
        const replace = confirm('Deseja mesclar com os dados atuais? (OK para MESCLAR, Cancelar para CANCELAR)');
        if (!replace) return;

        const cols = importedCols.map(c => ({ id: c.id?.toString() || uid(), title: c.title || c.titulo || 'Nova', sort_order: Number(c.sort_order || c.ordem || 1) }));
        const clis = importedClients.map(c => ({
          id: c.id?.toString() || uid(),
          column_id: c.column_id?.toString() || c.colunaId || cols[0]?.id || columns[0].id,
          name: c.name || c.nome || '',
          razao: c.razao || c.razaoSocial || '',
          doc: c.doc || c.cpfCnpj || '',
          phone: c.phone || c.telefone || '',
          address: c.address || c.endereco || '',
          obs: c.obs || c.observacao || '',
          created_at: Date.now(),
          updated_at: Date.now()
        }));

        await syncBatch(cols, clis);
        window.location.reload();

      } catch (err) {
        console.error(err);
        alert('Erro ao importar. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="board-container">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="logo" style={{background: 'transparent', boxShadow: 'none', width: 'auto', height: 40}}>
            <img src="/logo.png" alt="Cash Machine Logo" style={{height: '100%', objectFit: 'contain'}} />
          </div>
          <div className="brand-title">
            <strong>Cash Machine</strong>
            <span>CRM Local Premium</span>
          </div>
        </div>

        <div className="controls">
          <div style={{ position: 'relative' }} className="search-input">
            <Search size={16} style={{ position:'absolute', left: 10, top: 12, color: 'var(--muted)' }} />
            <input 
              className="input" 
              placeholder="Buscar cliente..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
          <button className="btn ghost" onClick={toggleTheme} title="Alterar Tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button className="btn ghost" onClick={() => { setEditingCol(null); setColModalOpen(true); }}>
            <Plus size={16} /> Coluna
          </button>
          
          <button className="btn primary" onClick={() => { setEditingClient(null); setClientModalOpen(true); }}>
            <Plus size={16} /> Cliente
          </button>

          <button className="btn ghost" onClick={downloadTemplate} title="Baixar Modelo">
            <FileSpreadsheet size={16} /> Modelo
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls" style={{ display: 'none' }} />
          <button className="btn ghost" onClick={() => fileInputRef.current?.click()} title="Importar Excel">
            <Upload size={16} /> Importar
          </button>

          <button className="btn ghost" onClick={handleExport} title="Exportar Excel">
            <Download size={16} /> Exportar
          </button>
        </div>
      </header>

      {/* Metrics */}
      <div className="metrics">
        <div className="metric-pill"><b>Total:</b> {clients.length}</div>
        {columns.map(c => (
          <div key={c.id} className="metric-pill">
            <span style={{color:'var(--muted)'}}>{c.title}:</span> <b>{stats[c.title]||0}</b>
          </div>
        ))}
      </div>

      {/* Board */}
      <main className="board-scroll">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map(col => {
              const colClients = filteredClients.filter(c => c.column_id === col.id);
              return (
                <SortableColumn 
                  key={col.id} 
                  column={col} 
                  onEdit={(c) => { setEditingCol(c); setColModalOpen(true); }}
                  onDelete={(c) => { setEditingCol(c); handleDeleteCol(); }}
                >
                  {colClients.length === 0 && (
                    <div className="empty-col">
                      <FileSpreadsheet size={24} />
                      Arraste cards ou adicione um novo
                    </div>
                  )}
                  
                  {colClients.map(client => (
                    <DraggableCard 
                      key={client.id} 
                      client={client} 
                      onClick={(c) => { setEditingClient(c); setClientModalOpen(true); }} 
                    />
                  ))}
                </SortableColumn>
              );
            })}
          </SortableContext>
          
          <DragOverlay>
            {activeColumn ? (
              <SortableColumn column={activeColumn} onEdit={()=>{}} onDelete={()=>{}}>
                 {filteredClients.filter(c => c.column_id === activeColumn.id).map(client => (
                    <DraggableCard key={client.id} client={client} onClick={()=>{}} />
                  ))}
              </SortableColumn>
            ) : null}
            {activeCard ? <div style={{width:'var(--col-w)'}}><DraggableCard client={activeCard} onClick={()=>{}} /></div> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Modals */}
      {isClientModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target.className.includes('modal-overlay') && setClientModalOpen(false)}>
          <form className="modal-content" onSubmit={handleSaveClient}>
            <div className="modal-header">
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Nome</label>
                <input className="input" name="name" defaultValue={editingClient?.name} required />
              </div>
              <div className="input-group">
                <label>Empresa / Razão Social</label>
                <input className="input" name="razao" defaultValue={editingClient?.razao} />
              </div>
              <div className="input-group">
                <label>Doc (CPF/CNPJ)</label>
                <input className="input" name="doc" defaultValue={editingClient?.doc} />
              </div>
              <div className="input-group">
                <label>Telefone</label>
                <input className="input" name="phone" defaultValue={editingClient?.phone} />
              </div>
              <div className="input-group full">
                <label>Endereço</label>
                <input className="input" name="address" defaultValue={editingClient?.address} />
              </div>
              <div className="input-group full">
                <label>Observação</label>
                <textarea className="textarea" name="obs" defaultValue={editingClient?.obs}></textarea>
              </div>
              <div className="input-group full">
                <label>Coluna / Etapa</label>
                <select className="select" name="column_id" defaultValue={editingClient?.column_id || columns[0]?.id}>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              {editingClient ? (
                <button type="button" className="btn danger" onClick={handleDeleteClient}>Excluir</button>
              ) : <div></div>}
              <div style={{display:'flex', gap: '8px'}}>
                <button type="button" className="btn ghost" onClick={() => setClientModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Salvar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isColModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target.className.includes('modal-overlay') && setColModalOpen(false)}>
          <form className="modal-content" style={{maxWidth: 400}} onSubmit={handleSaveCol}>
            <div className="modal-header">
              {editingCol ? 'Editar Coluna' : 'Nova Coluna'}
            </div>
            <div className="modal-body" style={{gridTemplateColumns: '1fr'}}>
              <div className="input-group">
                <label>Título da Coluna</label>
                <input className="input" name="title" defaultValue={editingCol?.title} autoFocus required />
              </div>
            </div>
            <div className="modal-footer" style={{justifyContent: 'flex-end'}}>
              <button type="button" className="btn ghost" onClick={() => setColModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn primary">Salvar</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
