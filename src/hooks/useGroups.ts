import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/AuthProvider";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const groupKeys = {
  all: ["groups"] as const,
  detail: (id: string) => ["groups", id] as const,
  members: (id: string) => ["groups", id, "members"] as const,
};

export type GroupWithMeta = Group & {
  activeOrders: number;
  isOwner: boolean;
  myActiveOrder: boolean;
};

export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*, orders(id, status, created_by)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data as any[]).map((g) => {
        const orders = g.orders ?? [];
        const activeOrders = orders.filter(
          (o: any) => o.status === "open" || o.status === "locked"
        );
        const myActiveOrder = activeOrders.some(
          (o: any) => o.created_by === user?.id
        );
        const { orders: _, ...group } = g;
        return {
          ...group,
          activeOrders: activeOrders.length,
          isOwner: g.created_by === user?.id,
          myActiveOrder,
        } as GroupWithMeta;
      });
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      description,
    }: {
      name: string;
      description: string | null;
    }) => {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({ name, description })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user!.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      return group as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("id")
        .eq("invite_code", inviteCode.trim().toLowerCase())
        .single();

      if (groupError || !group) throw new Error("Invalid invite code");

      const { data: existing } = await supabase
        .from("group_members")
        .select("id")
        .eq("group_id", group.id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) return { groupId: group.id, alreadyMember: true };

      const { error: joinError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user!.id,
          role: "member",
        });

      if (joinError) throw joinError;

      return { groupId: group.id, alreadyMember: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}
