const botStatus = {
  configured: false,
  state: 'not_started',
  username: null,
  id: null,
  expectedUsername: null,
  lastError: null,
  lastPollAt: null,
  lastUpdateAt: null,
  updatedAt: null,
};

export function updateBotStatus(patch) {
  Object.assign(botStatus, patch, { updatedAt: new Date().toISOString() });
}

export function getBotStatus() {
  return { ...botStatus };
}
