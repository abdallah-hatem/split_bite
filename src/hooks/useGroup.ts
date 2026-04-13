import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { groupKeys } from "./useGroups";

export type Member = {
  id: string;
  role: string;
  user_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
};

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: groupKeys.members(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, role, user_id, profiles(display_name, avatar_url)")
        .eq("group_id", groupId);

      if (error) throw error;
      return data as unknown as Member[];
    },
    enabled: !!groupId,
  });
}
