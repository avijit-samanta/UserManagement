import { useEffect, useState } from 'react';
import { DialogOverlay, DialogContent } from '@reach/dialog';
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/common/Card';
import { UserList } from '../components/admin/UserList';
import { UserProfileEditor } from '../components/admin/UserProfileEditor';
import { TicketList } from '../components/tickets/TicketList';
import { TicketDetail } from '../components/tickets/TicketDetail';
import { usersApi } from '../api/users';
import { ticketsApi } from '../api/tickets';
import type { PublicUser, Ticket } from '../types';

function UserProfilesSection() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi
      .list()
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card title="User Profiles" subtitle={`${users.length} accounts`}>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <UserList users={users} onSelect={setSelected} />
      )}

      <DialogOverlay isOpen={!!selected} onDismiss={() => setSelected(null)} className="app-dialog-overlay">
        <DialogContent className="app-dialog-content" aria-label="Edit user profile">
          {selected && (
            <UserProfileEditor
              user={selected}
              onUpdated={(updated) => {
                setSelected(updated);
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              }}
            />
          )}
        </DialogContent>
      </DialogOverlay>
    </Card>
  );
}

function QueryManagementSection() {
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

  return (
    <Card title="All user queries" subtitle={`${tickets.length} total`}>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <TicketList tickets={tickets} onSelect={setSelected} showSubmitter />
      )}

      <DialogOverlay isOpen={!!selected} onDismiss={() => setSelected(null)} className="app-dialog-overlay">
        <DialogContent className="app-dialog-content" aria-label="Ticket details">
          {selected && <TicketDetail ticket={selected} canRespond onRespond={handleRespond} />}
        </DialogContent>
      </DialogOverlay>
    </Card>
  );
}

export function AdminDashboardPage() {
  return (
    <AppShell
      sections={[
        { key: 'user-profiles', label: 'User Profiles', content: <UserProfilesSection /> },
        { key: 'query-management', label: 'Query Management', content: <QueryManagementSection /> },
      ]}
    />
  );
}
