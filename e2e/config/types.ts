export interface Credentials {
  email: string;
  password: string;
}

export interface ApiCheck {
  description: string;
  endpoint: string;
  expectedStatus: number;
}

export interface RoleTestData {
  role: 'admin' | 'user';
  label: string;
  credentials: Credentials;
  storageStateFile: string;
  loginSuccessTestId: string;
  expectedVisibleNavTestIds: string[];
  expectedAbsentNavTestIds: string[];
  apiChecks: ApiCheck[];
}

export interface ProfileUpdateData {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface NewTicketData {
  title: string;
  description: string;
}

export interface RegistrationScenario {
  role: 'admin' | 'user';
  name: string;
  emailPrefix: string;
  password: string;
  phone: string;
  address: string;
  loginSuccessTestId: string;
}

export interface AdminAddUserData {
  name: string;
  password: string;
  phone: string;
  address: string;
  role: 'admin' | 'user';
}

export interface TicketConversationData {
  title: string;
  description: string;
  adminMessages: string[];
  userReply: string;
}

export interface TestData {
  roles: RoleTestData[];
  profileUpdate: {
    user: ProfileUpdateData;
  };
  newTicket: NewTicketData;
  registration: RegistrationScenario[];
  adminAddUser: AdminAddUserData;
  ticketConversation: TicketConversationData;
}
