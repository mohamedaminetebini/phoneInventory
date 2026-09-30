import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  searchIPhones,
  type IPhoneCatalogItem,
} from "../../lib/catalog/iphones";
import { Drawer, DrawerContent, DrawerTitle } from "./ui/drawer";

type ModelPickerProps = {
  value?: IPhoneCatalogItem;
  onSelect: (item: IPhoneCatalogItem) => void;
};

export function ModelPicker({ value, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = searchIPhones(query);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const showPicker = () => {
    setQuery("");
    setOpen(true);
  };

  return (
    <>
      <button
        className={value ? "model-trigger is-selected" : "model-trigger"}
        type="button"
        onClick={showPicker}
        aria-label={value ? `Change iPhone model, current ${value.name}` : "Choose iPhone model"}
      >
        {value ? (
          <>
            <span className="device-mark" aria-hidden="true" />
            <span className="model-trigger-name">{value.name}</span>
            <span className="model-trigger-change">Change</span>
          </>
        ) : (
          <>
            <span className="model-trigger-placeholder">Choose iPhone model</span>
            <span className="model-trigger-arrow" aria-hidden="true">⌄</span>
          </>
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
        <DrawerContent className="model-picker-drawer-popup">
          <DrawerTitle className="visually-hidden">Choose iPhone model</DrawerTitle>
          {pickerPanel()}
        </DrawerContent>
      </Drawer>
    </>
  );

  function pickerPanel() {
    return (
      <section className="model-dialog model-picker-panel">
        <div className="model-dialog-header">
          <h2>Choose iPhone model</h2>
          <button className="icon-button" type="button" aria-label="Close model picker" onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <label className="model-search">
          <Search size={17} aria-hidden="true" />
          <span className="visually-hidden">Search models</span>
          <input
            ref={inputRef}
            type="search"
            aria-label="Search models"
            placeholder="Search by model name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && <span className="search-result-count">{results.length}</span>}
        </label>
        <div className="model-results">
          {results.map((item) => (
            <button
              key={item.id}
              className="model-option"
              type="button"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              <span className="device-mark" aria-hidden="true" />
              <span>{item.name}</span>
              <span className="model-option-year" aria-hidden="true">{item.year}</span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="model-empty">No iPhone models match “{query}”.</p>
          )}
        </div>
      </section>
    );
  }
}
