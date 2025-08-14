//Sidebar.txt
"use client";
import * as React from "react";
import PanelImage from "./PanelImage";
import PanelStyles from "./PanelStyles";
import type { Rgba } from "../lib/colors";

export default function Sidebar({
  selected,
  doc,
  onRequestSelect,
  readTextSelectionColor,
  setTextSelectionColor,
  onCommit,
  orientation, // ← додано
}: {
  selected: HTMLElement | null;
  doc: Document | null;
  onRequestSelect?: (el: HTMLElement) => void;
  readTextSelectionColor?: () => Rgba | null;
  setTextSelectionColor?: (c: Rgba) => boolean;
  onCommit?: (label?: string) => void;
  orientation: "portrait" | "landscape"; //
}) {
  const [tab, setTab] = React.useState<"image" | "styles">("image");
  const [selTick, setSelTick] = React.useState(0);

  React.useEffect(() => {
    if (!doc) return;
    const onSel = () => setSelTick((t) => t + 1);
    doc.addEventListener("selectionchange", onSel);
    return () => doc.removeEventListener("selectionchange", onSel);
  }, [doc]);

  return (
    <div className="mt-3 rounded-xl border bg-white">
      <div className="flex">
        <button
          onClick={() => setTab("image")}
          className={`flex-1 px-3 py-2 text-sm ${
            tab === "image" ? "bg-gray-900 text-white" : "bg-white"
          }`}
        >
          Image
        </button>
        <button
          onClick={() => setTab("styles")}
          className={`flex-1 px-3 py-2 text-sm ${
            tab === "styles" ? "bg-gray-900 text-white" : "bg-white"
          }`}
        >
          Styles
        </button>
      </div>

      <div className="p-3 max-h-[42vh] overflow-auto text-sm">
        {tab === "image" ? (
          <PanelImage
            selected={selected}
            doc={doc}
            onRequestSelect={onRequestSelect}
            onCommit={onCommit}
          />
        ) : (
          <PanelStyles
            selected={selected}
            orientation={orientation}
            readTextSelectionColor={readTextSelectionColor}
            setTextSelectionColor={setTextSelectionColor}
            _selTick={selTick} //
            onCommit={onCommit}
          />
        )}
      </div>
    </div>
  );
}
