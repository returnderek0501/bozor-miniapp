const addClient = new Map();
const findClient = new Map();
const tagAdd = new Map();
const tagFreeform = new Map();
const editField = new Map();
const changeOperator = new Map();
const clientList = new Map();
const broadcast = new Map();
const addStaff = new Map();
const addTagLabel = new Map();
const deskOperatorName = new Map();

export function clearAllPending(chatId) {
  addClient.delete(chatId);
  findClient.delete(chatId);
  tagAdd.delete(chatId);
  tagFreeform.delete(chatId);
  editField.delete(chatId);
  changeOperator.delete(chatId);
  clientList.delete(chatId);
  broadcast.delete(chatId);
  addStaff.delete(chatId);
  addTagLabel.delete(chatId);
  deskOperatorName.delete(chatId);
}

export const pending = {
  addClient,
  findClient,
  tagAdd,
  tagFreeform,
  editField,
  changeOperator,
  clientList,
  broadcast,
  addStaff,
  addTagLabel,
  deskOperatorName,
};
