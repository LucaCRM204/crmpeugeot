import { api } from "../api";

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  reportsTo: number | null;
  active: number | boolean;
};

export const listUsers = async (): Promise<User[]> =>
  (await api.get("/users")).data;

export const createUser = async (p: Partial<User> & { password?: string }) =>
  (await api.post("/users", p)).data;

export const deleteUser = async (id: number) =>
  (await api.delete(`/users/${id}`)).data;
export const updateUser = async (id: number, p: Partial<User> & { password?: string }) =>
  (await api.put(`/users/${id}`, p)).data;