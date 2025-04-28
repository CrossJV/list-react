import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { FixedSizeList } from 'react-window';
import { CSS } from '@dnd-kit/utilities';

interface Item {
  id: number;
  value: string;
}

interface SortableItemProps {
  id: number;
  value: string;
  isSelected: boolean;
  handleSelect: (id: number) => Promise<void>;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, value, isSelected, handleSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-2 bg-gray-100 mb-1 flex items-center text-black">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => handleSelect(id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="mr-2"
      />
      {value}
    </div>
  );
};

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const limit = 20;

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    const loadData = async () => {
      await fetchItems(offset, limit, search);
    };
    loadData();
  }, [offset, search, limit]);

  useEffect(() => {
    const fetchSelected = async () => {
      try {
        const response = await fetch('https://list-blue-xi.vercel.app/selected');
        if (!response.ok) throw new Error('Failed to fetch selected items');
        const selectedIds = await response.json();
        setSelected(selectedIds);
      } catch (error) {
        console.error('Error fetching selected items:', error);
      }
    };
    fetchSelected();
  }, []);

  const fetchItems = async (offset: number, limit: number, search: string = '') => {
    if (offset === 0 && items.length > 0 && !search) return;

    const url = search
      ? `https://list-blue-xi.vercel.app/search?q=${search}&offset=${offset}&limit=${limit}`
      : `https://list-blue-xi.vercel.app/items?offset=${offset}&limit=${limit}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch items');
      const newItems: Item[] = await response.json();
      setItems(prev => (offset === 0 ? newItems : [...prev, ...newItems]));
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over?.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
        try {
          await fetch('https://list-blue-xi.vercel.app/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: oldIndex, to: newIndex })
          });
        } catch (error) {
          console.error('Error moving item:', error);
        }
      }
    }
  };

  const handleSelect = async (id: number) => {
    const isSelected = selected.includes(id);
    const url = isSelected ? 'https://list-blue-xi.vercel.app/deselect' : 'https://list-blue-xi.vercel.app/select';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error('Failed to update selection');
      setSelected(prev => (isSelected ? prev.filter(s => s !== id) : [...prev, id]));
    } catch (error) {
      console.error('Error updating selection:', error);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setItems([]);
    setOffset(0);
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index];
    if (!item) return null;
    return (
      <div style={style}>
        <SortableItem
          key={item.id}
          id={item.id}
          value={item.value}
          isSelected={selected.includes(item.id)}
          handleSelect={handleSelect}
        />
      </div>
    );
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Список элементов</h1>
      <input
        type="text"
        value={search}
        onChange={handleSearch}
        placeholder="Поиск..."
        className="w-full p-2 mb-4 border rounded"
      />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(item => item.id)}>
          <FixedSizeList
            height={400}
            width="100%"
            itemCount={items.length}
            itemSize={50}
            onItemsRendered={({ visibleStopIndex }) => {
              if (visibleStopIndex >= items.length - 5) {
                setOffset(prev => prev + limit);
              }
            }}
          >
            {Row}
          </FixedSizeList>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default App;