import api from './api';

export const authService = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  logout: () =>
    api.post('/auth/logout'),

  changePassword: (current_password, new_password, confirm_password) =>
    api.post('/auth/change-password', { current_password, new_password, confirm_password }),

  getProfile: async () => {
    const res = await api.get('/auth/profile');
    return res.data;
  },
};
