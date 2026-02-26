import { useState, useRef, useEffect } from "react";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface Preset {
  label: string;
  getValue: () => DateRange;
}

const getPresets = (): Preset[] => {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return [
    {
      label: "This month",
      getValue: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: formatDate(start), to: formatDate(today) };
      },
    },
    {
      label: "Last month",
      getValue: () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: formatDate(start), to: formatDate(end) };
      },
    },
    {
      label: "Last 3 months",
      getValue: () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        return { from: formatDate(start), to: formatDate(today) };
      },
    },
    {
      label: "Year to date",
      getValue: () => {
        const start = new Date(today.getFullYear(), 0, 1);
        return { from: formatDate(start), to: formatDate(today) };
      },
    },
    {
      label: "All time",
      getValue: () => ({ from: "", to: "" }),
    },
  ];
};

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo, setCustomTo] = useState(value.to);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presets = getPresets();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync custom inputs when value changes externally
  useEffect(() => {
    setCustomFrom(value.from);
    setCustomTo(value.to);
  }, [value.from, value.to]);

  const getDisplayLabel = (): string => {
    if (!value.from && !value.to) return "All time";
    
    // Check if it matches a preset
    for (const preset of presets) {
      const presetValue = preset.getValue();
      if (presetValue.from === value.from && presetValue.to === value.to) {
        return preset.label;
      }
    }

    // Format custom range
    const formatDisplay = (d: string) => {
      if (!d) return "...";
      const date = new Date(d);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    return `${formatDisplay(value.from)} - ${formatDisplay(value.to)}`;
  };

  const handlePresetClick = (preset: Preset) => {
    const newValue = preset.getValue();
    onChange(newValue);
    setCustomFrom(newValue.from);
    setCustomTo(newValue.to);
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    onChange({ from: customFrom, to: customTo });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-gray-700">{getDisplayLabel()}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Presets */}
          <div className="p-2 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-1">
              {presets.map((preset) => {
                const presetValue = preset.getValue();
                const isActive = presetValue.from === value.from && presetValue.to === value.to;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className={`px-3 py-1.5 text-sm rounded-md text-left transition-colors ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom range */}
          <div className="p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Custom range</p>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label htmlFor="date-from" className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  id="date-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="date-to" className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  id="date-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              disabled={!customFrom || !customTo}
              className="w-full px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to get default "This month" range
export function getDefaultDateRange(): DateRange {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: start.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  };
}
