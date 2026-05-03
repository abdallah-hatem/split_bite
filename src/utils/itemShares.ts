/**
 * Decide whether an item's shares are an equal split (each person gets 1/N)
 * within a small tolerance for rounding.
 */
export function isEqualSplit(
  shares: { share_fraction: number }[]
): boolean {
  if (shares.length === 0) return true;
  const expected = 1 / shares.length;
  return shares.every(
    (s) => Math.abs(s.share_fraction - expected) < 0.001
  );
}

/**
 * Format share-name labels for display.
 * - Equal splits: just the names ("bodz, Guest 1").
 * - Custom splits: name + percentage ("bodz 60%, Guest 1 40%").
 *
 * Skips entries where the participant could not be resolved (returns null).
 */
export function formatShareLabels(
  shares: { participant_id: string; share_fraction: number }[],
  resolveName: (participantId: string) => string | null
): string[] {
  const equal = isEqualSplit(shares);
  return shares
    .map((s) => {
      const name = resolveName(s.participant_id);
      if (!name) return null;
      if (equal) return name;
      const pct = Math.round(s.share_fraction * 100);
      return `${name} ${pct}%`;
    })
    .filter((s): s is string => s !== null);
}
