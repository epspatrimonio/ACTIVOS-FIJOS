import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Filter, ArrowDownAZ, ArrowUpZA, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ExcelHeaderFilter({
  title,
  columnKey,
  data = [],
  selectedValues = [],
  onFilterChange,
  currentSort = {},
  onSortChange,
  getValue = (item) => item[columnKey],
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState([]);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popoverRef = useRef(null);

  // Recalculate position when opened
  const openPopover = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const popoverWidth = 288; // w-72 = 18rem = 288px
      const popoverHeight = 420; // approximate max height
      
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Keep within viewport horizontally
      if (left + popoverWidth > window.innerWidth - 8) {
        left = window.innerWidth - popoverWidth - 8;
      }
      if (left < 8) left = 8;
      
      // If not enough space below, show above
      if (top + popoverHeight > window.innerHeight - 8 && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 4;
      }
      
      setPopoverPos({ top, left });
    }
    setIsOpen(true);
  }, []);

  // Initialize tempSelected when popover opens
  useEffect(() => {
    if (isOpen) {
      setTempSelected([...selectedValues]);
      setSearch('');
    }
  }, [isOpen]); // Only depend on isOpen, not selectedValues

  // Extract all unique values from overall data
  const uniqueValues = React.useMemo(() => {
    const vals = new Set();
    data.forEach(item => {
      const val = getValue(item);
      vals.add(val === undefined || val === null ? '' : String(val).trim());
    });
    return Array.from(vals).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data, getValue]);

  // Filter unique values based on search query
  const filteredUniqueValues = React.useMemo(() => {
    if (!search) return uniqueValues;
    const q = search.toLowerCase();
    return uniqueValues.filter(v => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);

  const handleToggleValue = (val) => {
    setTempSelected(prev => {
      if (prev.includes(val)) {
        return prev.filter(v => v !== val);
      } else {
        return [...prev, val];
      }
    });
  };

  const handleSelectAllToggle = () => {
    setTempSelected(prev => {
      const allVisibleSelected = filteredUniqueValues.every(v => prev.includes(v));
      if (allVisibleSelected) {
        return prev.filter(v => !filteredUniqueValues.includes(v));
      } else {
        const toAdd = filteredUniqueValues.filter(v => !prev.includes(v));
        return [...prev, ...toAdd];
      }
    });
  };

  const handleApply = () => {
    onFilterChange(tempSelected);
    setIsOpen(false);
  };

  const handleClear = () => {
    onFilterChange([]);
    setIsOpen(false);
  };

  const handleSort = (dir) => {
    onSortChange(columnKey, dir);
    setIsOpen(false);
  };

  const isFilteredActive = selectedValues.length > 0;
  const isSortedActive = currentSort.key === columnKey;

  // Render the popover via a portal so it escapes any overflow-hidden container
  const popoverContent = isOpen ? createPortal(
    <>
      {/* Backdrop - transparent clickable overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={() => setIsOpen(false)}
      />
      {/* Popover Card */}
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: popoverPos.top,
          left: popoverPos.left,
          zIndex: 9999,
          width: 288,
        }}
        className="bg-white border border-slate-200 rounded-xl shadow-2xl p-3 text-slate-700 text-left font-normal text-sm"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Sort section */}
        <div className="space-y-1 pb-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => handleSort('asc')}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isSortedActive && currentSort.direction === 'asc'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowDownAZ className="w-4 h-4 text-slate-400" />
            <span>Ordenar de A a Z</span>
          </button>
          <button
            type="button"
            onClick={() => handleSort('desc')}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isSortedActive && currentSort.direction === 'desc'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ArrowUpZA className="w-4 h-4 text-slate-400" />
            <span>Ordenar de Z a A</span>
          </button>
        </div>

        {/* Clear Filter section */}
        {isFilteredActive && (
          <div className="py-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Borrar filtro de "{title}"</span>
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-medium placeholder-slate-400"
            />
          </div>
        </div>

        {/* Checklist */}
        <div className="py-1">
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-2 space-y-0.5">
            {/* Select All */}
            <label className="flex items-center gap-2.5 cursor-pointer hover:bg-white p-1.5 rounded transition-colors text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={filteredUniqueValues.length > 0 && filteredUniqueValues.every(v => tempSelected.includes(v))}
                onChange={handleSelectAllToggle}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer accent-blue-600"
              />
              <span>(SELECCIONAR TODO)</span>
            </label>

            {/* Unique values list */}
            {filteredUniqueValues.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-4 text-center">No hay coincidencias</div>
            ) : (
              filteredUniqueValues.map((val, idx) => {
                const isChecked = tempSelected.includes(val);
                return (
                  <label key={idx} className="flex items-center gap-2.5 cursor-pointer hover:bg-white p-1.5 rounded transition-colors text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleValue(val)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer accent-blue-600"
                    />
                    <span className="truncate">{val || '(Vacío)'}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 mt-1">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1.5 text-[11px] font-bold bg-[#00509d] hover:bg-[#003f7e] text-white rounded-lg shadow-sm active:scale-95 transition-all"
          >
            ACEPTAR
          </button>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div className={`relative inline-flex items-center gap-1 group/header select-none ${className}`}>
      <span className="font-extrabold text-white text-[0.6875rem] uppercase tracking-wider leading-tight">{title}</span>
      <button
        ref={btnRef}
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : openPopover()}
        className={`p-0.5 rounded transition-all cursor-pointer ${
          isFilteredActive || isSortedActive
            ? 'text-amber-300 bg-white/20 ring-1 ring-amber-300/40'
            : 'text-white/70 hover:text-white hover:bg-white/15'
        }`}
        title={`Filtrar ${title}`}
      >
        <Filter className="w-3.5 h-3.5" />
      </button>
      {popoverContent}
    </div>
  );
}
