import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  SectionList,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  ViewToken,
} from "react-native";
import {
  useRestaurants,
  Restaurant,
} from "@/src/hooks/useRestaurants";
import {
  useRestaurantMenu,
  MenuItem,
} from "@/src/hooks/useRestaurantMenu";
import { Colors, Spacing, FontSize, BorderRadius } from "@/src/lib/constants";

export type PickedMenuItem = {
  name: string;
  /** null when the menu didn't have a fixed price — caller should prompt. */
  price: number | null;
};

type SharedProps = {
  visible: boolean;
  onClose: () => void;
};

type RestaurantPickerProps = SharedProps & {
  mode: "restaurant";
  onPickRestaurant: (r: Restaurant) => void;
  onPickItem?: never;
  restaurantId?: never;
};

type ItemPickerProps = SharedProps & {
  mode?: "item";
  onPickItem: (item: PickedMenuItem) => void;
  onPickRestaurant?: never;
  /** When set, skips the restaurant-list step and opens that restaurant's menu directly. */
  restaurantId?: string | null;
};

export type PickFromMenuSheetProps =
  | RestaurantPickerProps
  | ItemPickerProps;

export function PickFromMenuSheet(props: PickFromMenuSheetProps) {
  const { visible, onClose } = props;
  const isRestaurantMode = props.mode === "restaurant";
  const lockedRestaurantId = !isRestaurantMode
    ? props.restaurantId ?? null
    : null;

  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [search, setSearch] = useState("");

  // When opened in item-mode with a locked restaurant, resolve and pre-select it.
  const { data: allRestaurants } = useRestaurants();
  useEffect(() => {
    if (!visible) return;
    if (!lockedRestaurantId) return;
    if (selectedRestaurant?.id === lockedRestaurantId) return;
    const found = allRestaurants?.find((r) => r.id === lockedRestaurantId);
    if (found) setSelectedRestaurant(found);
  }, [visible, lockedRestaurantId, allRestaurants, selectedRestaurant]);

  const close = () => {
    if (!lockedRestaurantId) setSelectedRestaurant(null);
    setSearch("");
    onClose();
  };

  const headerLeftLabel = lockedRestaurantId
    ? "Cancel"
    : selectedRestaurant
    ? "Back"
    : "Cancel";

  const headerLeftAction = () => {
    if (lockedRestaurantId) return close();
    if (selectedRestaurant) return setSelectedRestaurant(null);
    return close();
  };

  const headerTitle = selectedRestaurant
    ? selectedRestaurant.name
    : isRestaurantMode
    ? "Pick restaurant"
    : "Pick from menu";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={headerLeftAction}>
            <Text style={styles.headerAction}>{headerLeftLabel}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        {isRestaurantMode ? (
          <RestaurantList
            search={search}
            onSearchChange={setSearch}
            onSelect={(r) => {
              if (props.mode === "restaurant") {
                props.onPickRestaurant(r);
              }
            }}
          />
        ) : selectedRestaurant ? (
          <RestaurantMenu
            restaurant={selectedRestaurant}
            onPickItem={(item) => {
              // Narrowed: not restaurant mode here (above branch).
              (props as ItemPickerProps).onPickItem({
                name: item.name,
                price: item.price,
              });
              close();
            }}
          />
        ) : (
          <RestaurantList
            search={search}
            onSearchChange={setSearch}
            onSelect={setSelectedRestaurant}
          />
        )}
      </View>
    </Modal>
  );
}

function RestaurantList({
  search,
  onSearchChange,
  onSelect,
}: {
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (r: Restaurant) => void;
}) {
  const { data, isLoading } = useRestaurants(search);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search restaurants"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !data || data.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No restaurants yet</Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? "Try a different search."
              : "Restaurants appear here after they're added by the team."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.restaurantRow}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              {item.logo_url ? (
                <Image
                  source={{ uri: item.logo_url }}
                  style={styles.restaurantLogo}
                />
              ) : (
                <View
                  style={[
                    styles.restaurantLogo,
                    { backgroundColor: Colors.primaryLight },
                  ]}
                >
                  <Text style={styles.restaurantLogoText}>
                    {item.name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.cuisine && (
                  <Text style={styles.restaurantCuisine} numberOfLines={1}>
                    {item.cuisine}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function RestaurantMenu({
  restaurant,
  onPickItem,
}: {
  restaurant: Restaurant;
  onPickItem: (item: MenuItem) => void;
}) {
  const { data: categories, isLoading } = useRestaurantMenu(restaurant.id);
  const [search, setSearch] = useState("");
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const sectionListRef = useRef<SectionList<MenuItem> | null>(null);
  const categoryScrollRef = useRef<ScrollView | null>(null);
  const chipLayoutsRef = useRef<Record<number, { x: number; width: number }>>(
    {}
  );
  // While a tap-initiated scroll animation is in flight, SectionList fires
  // onViewableItemsChanged for every intermediate section it passes through,
  // which makes the active chip flicker and auto-scroll back and forth. We
  // suppress those updates while this ref is true and reset it on momentum
  // end (with a timeout fallback for short scrolls that don't trigger it).
  const programmaticScrollRef = useRef(false);
  const programmaticScrollResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter items by search query but keep the section structure so the
  // category bar stays meaningful.
  const sections = useMemo(() => {
    if (!categories) return [];
    const q = search.trim().toLowerCase();
    const filtered = categories
      .map((c) => ({
        title: c.name,
        data: q
          ? c.menu_items.filter(
              (it) =>
                it.name.toLowerCase().includes(q) ||
                (it.description ?? "").toLowerCase().includes(q)
            )
          : c.menu_items,
      }))
      .filter((s) => s.data.length > 0);
    return filtered;
  }, [categories, search]);

  // Reset active when sections shrink/grow (e.g., search).
  useEffect(() => {
    setActiveCategoryIdx(0);
    chipLayoutsRef.current = {};
  }, [sections.length]);

  // Keep the active chip in view as the list scrolls.
  useEffect(() => {
    const layout = chipLayoutsRef.current[activeCategoryIdx];
    const scrollView = categoryScrollRef.current;
    if (!layout || !scrollView) return;
    scrollView.scrollTo({
      x: Math.max(0, layout.x - 24),
      animated: true,
    });
  }, [activeCategoryIdx]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // Ignore intermediate viewability updates triggered by our own
      // scrollToLocation animation — those would chatter the active chip.
      if (programmaticScrollRef.current) return;
      // Pick the section of the topmost viewable header / item.
      const first = viewableItems.find((v) => v.index !== null);
      if (!first) return;
      const idx = (first as any).section?.index;
      if (typeof idx === "number") setActiveCategoryIdx(idx);
    }
  ).current;

  const handleCategoryTap = useCallback((idx: number) => {
    setActiveCategoryIdx(idx);
    programmaticScrollRef.current = true;
    if (programmaticScrollResetTimer.current) {
      clearTimeout(programmaticScrollResetTimer.current);
    }
    // Fallback unlock: in case onMomentumScrollEnd doesn't fire (short
    // scrolls, no momentum), release the lock after a fixed window.
    programmaticScrollResetTimer.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 800);

    try {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: idx,
        itemIndex: 0,
        animated: true,
        viewOffset: 0,
      });
    } catch {
      /* swallow — happens if items haven't measured yet */
    }
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    programmaticScrollRef.current = false;
    if (programmaticScrollResetTimer.current) {
      clearTimeout(programmaticScrollResetTimer.current);
      programmaticScrollResetTimer.current = null;
    }
  }, []);

  // Clear the timeout on unmount.
  useEffect(() => {
    return () => {
      if (programmaticScrollResetTimer.current) {
        clearTimeout(programmaticScrollResetTimer.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Menu is empty</Text>
        <Text style={styles.emptySubtitle}>
          Try refreshing the restaurant's menu from the scraper.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search this menu"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Horizontal category bar */}
      <View style={styles.categoryBar}>
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
          keyboardShouldPersistTaps="handled"
        >
          {sections.map((s, idx) => {
            const active = idx === activeCategoryIdx;
            return (
              <TouchableOpacity
                key={s.title + idx}
                onPress={() => handleCategoryTap(idx)}
                onLayout={(e) => {
                  chipLayoutsRef.current[idx] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  };
                }}
                style={[
                  styles.categoryCard,
                  active && styles.categoryCardActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryCardName,
                    active && styles.categoryCardNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {s.title}
                </Text>
                <Text
                  style={[
                    styles.categoryCardCount,
                    active && styles.categoryCardCountActive,
                  ]}
                >
                  {s.data.length} item{s.data.length === 1 ? "" : "s"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {sections.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptySubtitle}>
            Nothing in this menu matches "{search}".
          </Text>
        </View>
      ) : (
        <SectionList
          ref={(r) => {
            sectionListRef.current = r as SectionList<MenuItem> | null;
          }}
          sections={sections.map((s, index) => ({ ...s, index }))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 30,
            minimumViewTime: 50,
          }}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={() => {
            /* SectionList sometimes throws before items are measured */
          }}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemCard}
              onPress={() => onPickItem(item)}
              activeOpacity={0.7}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.itemImage}
                />
              ) : (
                <View
                  style={[
                    styles.itemImage,
                    {
                      backgroundColor: Colors.surfaceSecondary,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text style={styles.itemImageFallback}>
                    {item.name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {item.price === null ? (
                  <Text style={styles.itemPriceVaries}>Price varies</Text>
                ) : (
                  <Text style={styles.itemPrice}>
                    {restaurant.currency} {item.price.toFixed(2)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerAction: { fontSize: FontSize.md, color: Colors.primary, fontWeight: "600", minWidth: 56 },
  headerTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text, flex: 1, textAlign: "center" },

  searchWrap: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { backgroundColor: Colors.background, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text },

  list: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.lg, gap: Spacing.xs },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.text },
  emptySubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  // Restaurant list
  restaurantRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  restaurantLogo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  restaurantLogoText: { color: "#FFFFFF", fontWeight: "700", fontSize: FontSize.md },
  restaurantName: { fontSize: FontSize.md, fontWeight: "600", color: Colors.text },
  restaurantCuisine: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  // Category bar
  categoryBar: { backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  categoryBarContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
  categoryCard: { minWidth: 96, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  categoryCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 },
  categoryCardName: { fontSize: FontSize.sm, color: Colors.text, fontWeight: "700" },
  categoryCardNameActive: { color: "#FFFFFF" },
  categoryCardCount: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  categoryCardCountActive: { color: "rgba(255,255,255,0.85)" },

  // Section header
  sectionHeader: { paddingHorizontal: 0, paddingVertical: Spacing.sm, paddingTop: Spacing.lg },
  sectionHeaderText: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.text, letterSpacing: -0.3 },

  // Item card
  itemCard: { flexDirection: "row", gap: Spacing.md, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  itemImage: { width: 72, height: 72, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceSecondary },
  itemImageFallback: { fontSize: FontSize.xl, color: Colors.textTertiary, fontWeight: "700" },
  itemBody: { flex: 1, justifyContent: "space-between", gap: 4 },
  itemName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.text },
  itemDescription: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  itemPrice: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginTop: 2 },
  itemPriceVaries: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textTertiary, fontStyle: "italic", marginTop: 2 },
});
