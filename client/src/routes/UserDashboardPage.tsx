import { useEffect, useState } from 'react';
import { DialogOverlay, DialogContent } from '@reach/dialog';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/common/Card';
import { ProfileForm } from '../components/profile/ProfileForm';
import { TicketForm } from '../components/tickets/TicketForm';
import { TicketList } from '../components/tickets/TicketList';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { useAuth } from '../auth/AuthContext';
import { profileApi } from '../api/profile';
import { ticketsApi } from '../api/tickets';
import type { Ticket } from '../types';

function MyTicketsSection() {
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

  async function handleRespond(response: string) {
    if (!selected) return;
    const { ticket } = await ticketsApi.respond(selected.id, response);
    setSelected(ticket);
    await refresh();
  }

  async function handleReopen() {
    if (!selected) return;
    const { ticket } = await ticketsApi.reopen(selected.id);
    setSelected(ticket);
    await refresh();
  }

  return (
    <Card title="My Tickets" subtitle={`${tickets.length} submitted`}>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <TicketList tickets={tickets} onSelect={setSelected} />
      )}

      <DialogOverlay isOpen={!!selected} onDismiss={() => setSelected(null)} className="app-dialog-overlay">
        <DialogContent className="app-dialog-content" aria-label="Ticket details">
          {selected && (
            <TicketDetail ticket={selected} canReply canReopen onRespond={handleRespond} onReopen={handleReopen} />
          )}
        </DialogContent>
      </DialogOverlay>
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
                onSubmit={async (title, description) => {
                  await ticketsApi.create(title, description);
                  setTicketsVersion((v) => v + 1);
                }}
              />
            </Card>
          ),
        },
        {
          key: 'my-tickets',
          label: 'My Tickets',
          content: <MyTicketsSection key={ticketsVersion} />,
        },
      ]}
    />
  );
}
