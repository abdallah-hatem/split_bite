import {
  isParticipantEntangled,
  EntanglementItem,
} from "@/src/utils/orderEntanglement";

describe("isParticipantEntangled", () => {
  it("returns false when there are no items", () => {
    expect(isParticipantEntangled([], "p1")).toBe(false);
  });

  it("returns false when the user has no involvement in any item", () => {
    const items: EntanglementItem[] = [
      { added_by_participant_id: "p2", item_shares: [{ participant_id: "p2" }] },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(false);
  });

  it("returns false when the user has only a solo item they added", () => {
    const items: EntanglementItem[] = [
      { added_by_participant_id: "p1", item_shares: [{ participant_id: "p1" }] },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(false);
  });

  it("returns true when the user added an item that has shares from others", () => {
    const items: EntanglementItem[] = [
      {
        added_by_participant_id: "p1",
        item_shares: [
          { participant_id: "p1" },
          { participant_id: "p2" },
        ],
      },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(true);
  });

  it("returns true when the user has a share in an item shared with others", () => {
    const items: EntanglementItem[] = [
      {
        added_by_participant_id: "p2",
        item_shares: [
          { participant_id: "p2" },
          { participant_id: "p1" },
        ],
      },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(true);
  });

  it("returns false when user is sole sharer on an item someone else added", () => {
    // Edge case: host added an item but only this user shares it.
    // Deleting them cascades the share; the item is left with zero shares
    // but is otherwise orphaned from the user. Allowed.
    const items: EntanglementItem[] = [
      { added_by_participant_id: "p2", item_shares: [{ participant_id: "p1" }] },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(false);
  });

  it("returns true when user added an item that has only OTHER people's shares", () => {
    // Host added a pizza for a guest; host has no share, but cascading
    // delete via added_by would wipe the guest's share too.
    const items: EntanglementItem[] = [
      { added_by_participant_id: "p1", item_shares: [{ participant_id: "p2" }] },
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(true);
  });

  it("returns true if any item entangles, even when others are clean", () => {
    const items: EntanglementItem[] = [
      { added_by_participant_id: "p1", item_shares: [{ participant_id: "p1" }] }, // solo
      {
        added_by_participant_id: "p2",
        item_shares: [
          { participant_id: "p1" },
          { participant_id: "p2" },
        ],
      }, // shared with p2
    ];
    expect(isParticipantEntangled(items, "p1")).toBe(true);
  });

  it("treats missing item_shares as empty (defensive)", () => {
    const items = [
      { added_by_participant_id: "p1" },
    ] as EntanglementItem[];
    expect(isParticipantEntangled(items, "p1")).toBe(false);
  });
});
