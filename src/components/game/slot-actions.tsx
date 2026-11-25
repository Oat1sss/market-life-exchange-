"use client";

import { useFormStatus } from "react-dom";
import { activateSlotAction, deleteSlotAction } from "@/app/actions/game";

function SlotButton({
  label,
  pendingLabel,
  tone,
}: {
  readonly label: string;
  readonly pendingLabel: string;
  readonly tone: "brand" | "ghost" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles =
    tone === "brand"
      ? "bg-brand text-[#04120e] hover:bg-brand-strong"
      : tone === "danger"
        ? "border border-down/30 text-down hover:bg-down/10"
        : "border border-line text-[#c7ccd4] hover:border-brand/40 hover:text-brand";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[11px] font-black transition disabled:opacity-50 ${styles}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SlotActions({
  gameId,
  isActive,
}: {
  readonly gameId: string;
  readonly isActive: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isActive ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-[11px] font-black text-brand ring-1 ring-inset ring-brand/20">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          Sedang dimainkan
        </span>
      ) : (
        <form action={activateSlotAction}>
          <input type="hidden" name="gameId" value={gameId} />
          <SlotButton label="Lanjutkan" pendingLabel="Memuat…" tone="brand" />
        </form>
      )}

      <form
        action={deleteSlotAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Hapus slot ini? Karakter, portofolio, dan seluruh riwayatnya akan hilang permanen.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="gameId" value={gameId} />
        <SlotButton label="Hapus" pendingLabel="Menghapus…" tone="danger" />
      </form>
    </div>
  );
}
