import { ProfileForm } from '../profile/ProfileForm';
import { usersApi } from '../../api/users';
import type { PublicUser } from '../../types';

export function UserProfileEditor({ user, onUpdated }: { user: PublicUser; onUpdated: (user: PublicUser) => void }) {
  return (
    <ProfileForm
      user={user}
      testIdPrefix="admin-user"
      onSave={async (values) => {
        const { user: updated } = await usersApi.update(user.id, values);
        onUpdated(updated);
        return updated;
      }}
    />
  );
}
