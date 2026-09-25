import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { AppDialog } from '../components/common/AppDialog';
import { UserList } from '../components/admin/UserList';
import { UserProfileEditor } from '../components/admin/UserProfileEditor';
import { AddUserForm } from '../components/admin/AddUserForm';
import { TicketList } from '../components/tickets/TicketList';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { FileRepository } from '../components/attachments/FileRepository';
import { usersApi } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { ticketsApi } from '../api/tickets';
import type { PublicUser, Ticket } from '../types';

function UserProfilesSection({ onUserDeleted }: { onUserDeleted: () => void }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleDelete(target: PublicUser) {
    await usersApi.remove(target.id);
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    if (selected?.id === target.id) setSelected(null);
    onUserDeleted();
  }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi
      .list()
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card
      title="User Profiles"
      subtitle={`${users.length} accounts`}
      actions={
        <Button type="button" onClick={() => setAdding(true)} data-testid="open-add-user-button">
          + Add User
        </Button>
      }
    >
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <UserList users={users} onSelect={setSelected} currentUserId={currentUser?.id} onDelete={handleDelete} />
      )}

      <AppDialog isOpen={!!selected} onDismiss={() => setSelected(null)} ariaLabel="Edit user profile">
        {selected && (
          <UserProfileEditor
            user={selected}
            onUpdated={(updated) => {
              setSelected(updated);
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            }}
          />
        )}
      </AppDialog>

      <AppDialog isOpen={adding} onDismiss={() => setAdding(false)} ariaLabel="Add new user">
        <AddUserForm
          onCreated={(created) => {
            setUsers((prev) => [...prev, created]);
            setAdding(false);
          }}
        />
      </AppDialog>
    </Card>
  );
}

function QueryManagementSection({ onAttachmentUploaded }: { onAttachmentUploaded: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { tickets } = await ticketsApi.list();
    setTickets(tickets);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleRespond(response: string, files: File[]) {
    if (!selected) return;
    const { ticket } = await ticketsApi.respond(selected.id, response, files);
    setSelected(ticket);
    // See UserDashboardPage's identical comment: not awaited so the form
    // re-enables as soon as the reply itself lands, without waiting on
    // this second, unrelated list-refresh too.
    refresh().catch((err) => console.error('Failed to refresh ticket list', err));
    // Reach Tabs keeps the File Repository panel mounted, so it needs an
    // explicit nudge to refetch whenever a reply here attaches a new file.
    if (files.length > 0) onAttachmentUploaded();
  }

  async function handleDelete(ticket: Ticket) {
    await ticketsApi.remove(ticket.id);
    setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    if (selected?.id === ticket.id) setSelected(null);
    // The ticket's attachments are deleted with it, so the File Repository
    // tab (kept mounted by Reach Tabs) needs to refetch as well.
    if ((ticket.attachments?.length ?? 0) > 0 || ticket.messages.some((m) => (m.attachments?.length ?? 0) > 0)) onAttachmentUploaded();
  }

  async function handleClose() {
    if (!selected) return;
    const { ticket } = await ticketsApi.close(selected.id);
    setSelected(ticket);
    refresh().catch((err) => console.error('Failed to refresh ticket list', err));
  }

  return (
    <Card title="All user queries" subtitle={`${tickets.length} total`}>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <TicketList tickets={tickets} onSelect={setSelected} showSubmitter onDelete={handleDelete} />
      )}

      <AppDialog isOpen={!!selected} onDismiss={() => setSelected(null)} ariaLabel="Ticket details">
        {selected && (
          <TicketDetail ticket={selected} canReply canClose onRespond={handleRespond} onClose={handleClose} />
        )}
      </AppDialog>
    </Card>
  );
}

export function AdminDashboardPage() {
  const [filesVersion, setFilesVersion] = useState(0);
  const bumpFilesVersion = () => setFilesVersion((v) => v + 1);
  // Deleting a user also deletes their tickets and files, so the other two
  // (always-mounted) tabs need the same remount-to-refetch nudge.
  const [ticketsVersion, setTicketsVersion] = useState(0);
  const handleUserDeleted = () => {
    setTicketsVersion((v) => v + 1);
    bumpFilesVersion();
  };

  return (
    <AppShell
      sections={[
        {
          key: 'user-profiles',
          label: 'User Profiles',
          content: <UserProfilesSection onUserDeleted={handleUserDeleted} />,
        },
        {
          key: 'query-management',
          label: 'Query Management',
          content: <QueryManagementSection key={ticketsVersion} onAttachmentUploaded={bumpFilesVersion} />,
        },
        { key: 'file-repository', label: 'File Repository', content: <FileRepository key={filesVersion} /> },
      ]}
    />
  );
}
