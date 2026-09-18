import type { PublicUser } from '../../types';

export function UserList({
  users,
  onSelect,
  selectedId,
}: {
  users: PublicUser[];
  onSelect: (user: PublicUser) => void;
  selectedId?: string;
}) {
  if (users.length === 0) {
    return <div className="empty-state">No users found.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className={user.id === selectedId ? 'selected' : ''}
              onClick={() => onSelect(user)}
              data-testid={`user-row-${user.id}`}
            >
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
