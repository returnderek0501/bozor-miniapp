const customOperator = new Map();
const addClient = new Map();
const findClient = new Map();
const tagPhoto = new Map();

export function clearAllPending(chatId) {
  customOperator.delete(chatId);
  addClient.delete(chatId);
  findClient.delete(chatId);
  tagPhoto.delete(chatId);
}

export const pending = {
  customOperator,
  addClient,
  findClient,
  tagPhoto,
};
