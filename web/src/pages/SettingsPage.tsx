import { useEffect, useState } from "react";
import { getBlacklist, updateBlacklist } from "@/shared/api/client";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Plus, Trash2, AlertTriangle, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

export function SettingsPage() {
  const [items, setItems] = useState<string[]>([]);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBlacklist()
      .then((res) => {
        setItems(res.items);
        setDraftItems(res.items);
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const addItem = () => {
    const trimmed = newItem.trim().toLowerCase();
    if (!trimmed) return;
    if (draftItems.includes(trimmed)) {
      setNewItem("");
      return;
    }
    setDraftItems((prev) => [...prev, trimmed]);
    setNewItem("");
  };

  const removeItem = (idx: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await updateBlacklist(draftItems);
      setItems(res.items);
      setDraftItems(res.items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Failed to save blacklist");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify([...items].sort()) !== JSON.stringify([...draftItems].sort());

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-accent-400" />
          Settings
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Configure filtering rules applied during image verification
        </p>
      </div>

      <Card variant="glass" className="mb-6">
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-neutral-200">
              Image Blacklist
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              When you add terms here, Gemini will reject any image containing the
              specified content. Changes apply to the next verification batch — no
              server restart needed.
            </p>
          </div>
        </div>

        {/* Add new item */}
        <div className="flex gap-2 mb-5">
          <Input
            placeholder="e.g. cartoon, text overlay, diagram..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="md"
            onClick={addItem}
            disabled={!newItem.trim()}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Items list */}
        {draftItems.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-8 text-center">
            <p className="text-sm text-neutral-600">
              No blacklist items — all content types are allowed
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {draftItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 group"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="uppercase text-[10px] tracking-wider">
                    BLOCKED
                  </Badge>
                  <span className="text-sm text-neutral-200">{item}</span>
                </div>
                <button
                  onClick={() => removeItem(i)}
                  className="p-1 rounded-lg text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  );
}
