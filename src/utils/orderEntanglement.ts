/**
 * Pre-flight check for "leave order" / "remove participant".
 *
 * Returns true if removing the given participant would either (a) cascade-delete
 * items that other participants also share, or (b) leave shared items with
 * fractions that no longer sum to 1.0. In either case the leave / kick is
 * blocked and the caller surfaces a "delete those items first" message.
 *
 * Keeping this as a pure function over the already-fetched items lets us unit
 * test the rules without mocking supabase.
 */

export type EntanglementItem = {
  added_by_participant_id: string;
  item_shares: { participant_id: string }[];
};

/**
 * @returns true if the participant is entangled with at least one other
 *   participant and therefore cannot be removed safely.
 */
export function isParticipantEntangled(
  items: EntanglementItem[],
  participantId: string
): boolean {
  for (const item of items) {
    const shares = item.item_shares ?? [];
    const othersOnThisItem = shares.some(
      (s) => s.participant_id !== participantId
    );

    // Case 1: user is `added_by` on an item with other people's shares.
    // Deleting the user would cascade-delete the item, taking their shares.
    if (item.added_by_participant_id === participantId && othersOnThisItem) {
      return true;
    }

    // Case 2: user has a share on an item with other people's shares.
    // Deleting the user removes their fraction, breaking the share sum.
    const userHasShare = shares.some(
      (s) => s.participant_id === participantId
    );
    if (userHasShare && othersOnThisItem) {
      return true;
    }
  }
  return false;
}
