import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listAllUsers, updateUserRole, deleteUser } from "@/lib/users.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const list = useServerFn(listAllUsers);
  const updateRole = useServerFn(updateUserRole);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    try {
      await updateRole({
        data: {
          userId,
          role: "admin",
          action: currentlyAdmin ? "remove" : "add",
        },
      });
      toast.success(currentlyAdmin ? "Admin role removed" : "Admin role granted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-black/5">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Display Name</th>
            <th className="px-4 py-3 font-medium">Roles</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {(users ?? []).map((u: any) => (
            <tr key={u.id}>
              <td className="px-4 py-4 font-mono text-xs">{u.email}</td>
              <td className="px-4 py-4 font-medium">{u.display_name || "—"}</td>
              <td className="px-4 py-4">
                <div className="flex gap-1">
                  {u.roles.map((r: string) => (
                    <span
                      key={r}
                      className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider"
                    >
                      {r}
                    </span>
                  ))}
                  {u.roles.length === 0 && (
                    <span className="text-xs text-muted-foreground">user</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-4 text-right space-x-3">
                <button
                  onClick={() => toggleAdmin(u.id, u.isAdmin)}
                  className={
                    "text-xs underline " +
                    (u.isAdmin ? "text-destructive" : "text-accent")
                  }
                >
                  {u.isAdmin ? "Remove admin" : "Make admin"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete user "${u.email}"? This cannot be undone.`))
                      deleteMut.mutate(u.id);
                  }}
                  className="text-xs text-destructive underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}