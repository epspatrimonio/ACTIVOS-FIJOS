import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function SearchableSelect({
  label,
  name,
  value,
  onChange,
  options = [],
  required = false,
  placeholder = 'Seleccionar...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Find currently selected option
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayValue = selectedOption ? selectedOption.label : '';

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options
  const filteredOptions = options.filter(opt =>
    (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find first suggestion that starts with the search term (case-insensitive)
  const firstMatch = searchTerm.trim() !== ''
    ? options.find(opt => (opt.label || '').toLowerCase().startsWith(searchTerm.toLowerCase()))
    : null;

  // Build suggestion text matching user's typed case for the prefix
  const suggestionText = firstMatch && searchTerm
    ? searchTerm + firstMatch.label.slice(searchTerm.length)
    : '';

  const handleSelect = (val) => {
    onChange({ target: { name, value: val } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm(''); // Show all options when focused
  };

  // Keyboard navigation for autocomplete
  const handleKeyDown = (e) => {
    if (isOpen && firstMatch && suggestionText) {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleSelect(firstMatch.value);
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      {label && (
        <label className="block text-[0.8125rem] font-semibold text-slate-600 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center w-full bg-white border border-slate-300 hover:border-slate-400 rounded-lg shadow-sm focus-within:ring-4 focus-within:ring-brand-500/10 focus-within:border-brand-600 transition-all">
        <input
          type="text"
          name={name}
          className="block w-full px-3 py-2 pr-12 bg-transparent border-none shadow-none focus:outline-none focus:ring-0 text-slate-800 font-medium placeholder-slate-400 cursor-text"
          placeholder={isOpen ? placeholder : (displayValue || placeholder)}
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {value && (
          <button
            type="button"
            onClick={() => handleSelect('')}
            className="absolute right-8 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 text-slate-400 p-0.5 rounded-md hover:bg-slate-200/50"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto py-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                  String(opt.value) === String(value)
                    ? 'bg-brand-50/50 text-brand-600 font-semibold'
                    : 'text-slate-700 font-medium'
                }`}
              >
                <span>{opt.label}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-slate-400 italic">No se encontraron resultados</div>
          )}
        </div>
      )}
    </div>
  );
}
