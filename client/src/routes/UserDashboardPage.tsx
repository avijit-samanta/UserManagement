import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/common/Card';
import { AppDialog } from '../components/common/AppDialog';
import { ProfileForm } from '../components/profile/ProfileForm';
import { TicketForm } from '../components/tickets/TicketForm';
import { TicketList } from '../components/tickets/TicketList';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { FileRepository } from '../components/attachments/FileRepository';
import { useAuth } from '../auth/AuthContext';
import { profileApi } from '../api/profile';
import { ticketsApi } from '../api/tickets';
import type { Ticket } from '../types';

function MyTicketsSection({ onAttachmentUploaded }: { onAttachmentUploaded: () => void }) {
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
    // Not awaited: the dialog already has everything it needs from
    // `ticket` above — this just keeps the row behind it (status/updated
    // time) current. Awaiting it here would keep TicketDetail's form
    // disabled ("Sending…") until this second, unrelated request also
    // finishes — unnoticeable against the old near-instant local JSON
    // file, but a real, visible delay against a remote database.
    refresh().catch((err) => console.error('Failed to refresh ticket list', err));
    // Same "Reach Tabs keeps every panel mounted" issue as ticketsVersion
    // below, but for the File Repository tab: a reply can carry a new
    // attachment, so it needs to know to refetch too.
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

  async function handleReopen() {
    if (!selected) return;
    const { ticket } = await ticketsApi.reopen(selected.id);
    setSelected(ticket);
    refresh().catch((err) => console.error('Failed to refresh ticket list', err));
  }

  return (
    <Card title="My Tickets" subtitle={`${tickets.length} submitted`}>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <TicketList tickets={tickets} onSelect={setSelected} onDelete={handleDelete} />
      )}

      <AppDialog isOpen={!!selected} onDismiss={() => setSelected(null)} ariaLabel="Ticket details">
        {selected && (
          <TicketDetail ticket={selected} canReply canReopen onRespond={handleRespond} onReopen={handleReopen} />
        )}
      </AppDialog>
    </Card>
  );
}

export function UserDashboardPage() {
  const { user, setUser } = useAuth();
  // Reach Tabs keeps every panel mounted (just hidden) once the dashboard
  // loads, so "My Tickets" won't see a ticket created via "Submit New
  // Request" unless we force it to remount and refetch. Bumping this key
  // after a successful submission does that.
  const [ticketsVersion, setTicketsVersion] = useState(0);
  // Same remount trick, for the File Repository tab: it needs to refetch
  // whenever a new ticket or reply attaches a file, not just on first load.
  const [filesVersion, setFilesVersion] = useState(0);
  const bumpFilesVersion = () => setFilesVersion((v) => v + 1);

  if (!user) return null;

  return (
    <AppShell
      sections={[
        {
          key: 'my-profile',
          label: 'My Profile',
          content: (
            <Card title="My Profile" subtitle="Keep your contact details up to date.">
              <ProfileForm
                user={user}
                onSave={async (values) => {
                  const { user: updated } = await profileApi.update(values);
                  setUser(updated);
                  return updated;
                }}
              />
            </Card>
          ),
        },
        {
          key: 'new-request',
          label: 'Submit New Request',
          content: (
            <Card title="Submit New Request" subtitle="Send a question or issue to the administrator.">
              <TicketForm
                onSubmit={async (title, description, files) => {
                  await ticketsApi.create(title, description, files);
                  setTicketsVersion((v) => v + 1);
                  if (files.length > 0) bumpFilesVersion();
                }}
              />
            </Card>
          ),
        },
        {
          key: 'my-tickets',
          label: 'My Tickets',
          content: <MyTicketsSection key={ticketsVersion} onAttachmentUploaded={bumpFilesVersion} />,
        },
        {
          key: 'file-repository',
          label: 'File Repository',
          content: <FileRepository key={filesVersion} />,
        },
      ]}
    />
  );
}
