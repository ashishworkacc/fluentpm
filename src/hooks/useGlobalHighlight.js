import { useState, useEffect } from "react";

export function useGlobalHighlight(onSave, currentScreen) {
  const [selection, setSelection] = useState({ text: "", pos: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function handleMouseUp(e) {
      const noHighlightScreens = ["battle", "interview", "preBattle"];
      if (noHighlightScreens.includes(currentScreen)) return;

      // Skip if clicking on input/textarea/button
      const target = e.target;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;

      // Skip if target or ancestor has data-no-highlight
      if (target.closest("[data-no-highlight]")) return;

      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 2 && text.length < 200) {
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelection({ text, pos: { x: rect.left + rect.width / 2, y: rect.top - 8 } });
          } catch {}
        } else {
          setSelection({ text: "", pos: null });
        }
      }, 50);
    }

    function handleMouseDown(e) {
      if (e.target.closest("[data-lexicon-btn]")) return; // don't clear when clicking save
      setSelection({ text: "", pos: null });
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [currentScreen]);

  async function handleSave() {
    if (!selection.text || saving) return;
    setSaving(true);
    try {
      await onSave(selection.text);
      setSaved(true);
      setSelection({ text: "", pos: null });
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  }

  return { selection, saving, saved, handleSave };
}
