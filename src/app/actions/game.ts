"use server";

/**
 * Game mutations invoked from forms via `useActionState`. Every handler
 * verifies the session server-side; the data mutations live in the services,
 * not here (docs/ARCHITECTURE.md §3.1).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/server/session";
import {
  advanceGame,
  createGame,
  enrollEducation,
  pendingLifeEvent,
  resolveLifeEvent,
  GameError,
} from "@/server/services/game-service";
import { BACKGROUNDS, type BackgroundKey } from "@/domain/character";
import {
  activateSaveSlot,
  deleteSaveSlot,
  SaveError,
} from "@/server/services/save-service";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const MAX_INPUT = 80;

function clean(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_INPUT);
}

export async function createCharacterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  const background = clean(formData.get("background"));

  if (firstName.length < 1 || lastName.length < 1) {
    return { error: "First and last name are both required." };
  }
  if (!(background in BACKGROUNDS)) {
    return { error: "Pick a starting background." };
  }

  try {
    await createGame(userId, {
      firstName,
      lastName,
      background: background as BackgroundKey,
    });
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    return { error: "Could not start this life. Try again." };
  }
  redirect("/play");
}

export async function activateSlotAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const gameId = clean(formData.get("gameId"));
  if (!gameId) return;
  try {
    await activateSaveSlot(userId, gameId);
  } catch (error) {
    if (error instanceof SaveError) return;
    throw error;
  }
  revalidatePath("/play");
  revalidatePath("/play/start");
  redirect("/play");
}

export async function deleteSlotAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const gameId = clean(formData.get("gameId"));
  if (!gameId) return;
  await deleteSaveSlot(userId, gameId);
  revalidatePath("/play");
  revalidatePath("/play/start");
  redirect("/play/start");
}

export async function advanceAction(): Promise<ActionState> {
  const userId = await requireUserId();
  try {
    await advanceGame(userId);
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    return { error: "Could not advance this month. Try again." };
  }
  revalidatePath("/play");
  revalidatePath("/play/market");
  revalidatePath("/play/portfolio");
  return { ok: true };
}

export async function resolveLifeEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const templateKey = clean(formData.get("templateKey"));
  const choiceKey = clean(formData.get("choiceKey"));
  try {
    await resolveLifeEvent(userId, { templateKey, choiceKey });
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    return { error: "Could not resolve the event. Try again." };
  }
  revalidatePath("/play");
  return { ok: true };
}

export const serverResolveLifeEvent = resolveLifeEventAction;

export async function enrollAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const programKey = clean(formData.get("programKey"));
  try {
    await enrollEducation(userId, programKey);
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    return { error: "Could not enroll. Try again." };
  }
  revalidatePath("/play");
  return { ok: true };
}

/** Session-bound pending life event used by the dashboard card. */
export async function loadPendingEventForSession() {
  const userId = await requireUserId();
  return pendingLifeEvent(userId);
}
