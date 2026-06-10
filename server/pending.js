const addClient = new Map();
const findClient = new Map();
const tagAdd = new Map();
const editField = new Map();
const broadcast = new Map();
const addStaff = new Map();

export function clearAllPending(chatId) {
  addClient.delete(chatId);
  findClient.delete(chatId);
  tagAdd.delete(chatId);
  editField.delete(chatId);
  broadcast.delete(chatId);
  addStaff.delete(chatId);
}

export const pending = {
  addClient,
  findClient,
  tagAdd,
  editField,
  broadcast,
  addStaff,
};
