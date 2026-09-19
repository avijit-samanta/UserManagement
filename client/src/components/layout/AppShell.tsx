import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@reach/tabs';
import { Menu, MenuButton, MenuList, MenuItem } from '@reach/menu-button';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../hooks/useTheme';

export interface ShellSection {
  key: string;
  label: string;
  content: ReactNode;
}

export function AppShell({ sections }: { sections: ShellSection[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    await logout();
    navigate('/logout');
  }

  const initials = user?.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <div className="app-header-mark" />
          <span className="app-header-title">Simple Help Desk</span>
        </div>
        <div className="app-header-right">
          <Menu>
            <MenuButton className="user-menu-button" data-testid="user-menu-button">
              <span className="user-chip-avatar">{initials}</span>
              <span>{user?.name}</span>
              <span className="role-tag">{user?.role}</span>
              <span aria-hidden className="user-menu-caret">▾</span>
            </MenuButton>
            <MenuList className="user-menu-list">
              <MenuItem onSelect={toggle} data-testid="theme-toggle-menu-item">
                {theme === 'light' ? '🌙' : '☀️'} Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
              </MenuItem>
              <MenuItem onSelect={handleLogout} data-testid="logout-button">
                🚪 Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </div>
      </header>

      <Tabs className="app-body" orientation="vertical">
        <TabList className="side-nav">
          {sections.map((section) => (
            <Tab key={section.key} className="side-nav-item" data-testid={`nav-${section.key}`}>
              {section.label}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="content-area">
          {sections.map((section) => (
            <TabPanel key={section.key}>{section.content}</TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
}
