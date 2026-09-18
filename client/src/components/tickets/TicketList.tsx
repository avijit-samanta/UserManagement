import { StatusBadge } from './StatusBadge';
import type { Ticket } from '../../types';

export function TicketList({
  tickets,
  onSelect,
  selectedId,
  showSubmitter = false,
}: {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  selectedId?: string;
  showSubmitter?: boolean;
}) {
  if (tickets.length === 0) {
    return <div className="empty-state">No tickets yet.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticket ID</th>
            <th>Title</th>
            {showSubmitter && <th>Submitted by</th>}
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className={ticket.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(ticket)}
              data-testid={`ticket-row-${ticket.id}`}
            >
              <td>{ticket.id}</td>
              <td>{ticket.title}</td>
              {showSubmitter && <td>{ticket.submittedByName}</td>}
              <td>
                <StatusBadge status={ticket.status} />
              </td>
              <td>{new Date(ticket.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
