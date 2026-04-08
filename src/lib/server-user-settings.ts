export interface ServerUserSettings {
  apiKey: string;
  models: string[];
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // noop
  }

  return `HTTP ${response.status}`;
};

export const fetchUserSettings = async (userId: string): Promise<ServerUserSettings> => {
  const response = await fetch(`/api/user-settings?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as Partial<ServerUserSettings>;
  const models = Array.isArray(payload.models)
    ? payload.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
    models
  };
};

export const saveUserSettings = async (
  userId: string,
  settings: ServerUserSettings
): Promise<ServerUserSettings> => {
  const response = await fetch('/api/user-settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      userId,
      apiKey: settings.apiKey,
      models: settings.models
    })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as Partial<ServerUserSettings>;
  const models = Array.isArray(payload.models)
    ? payload.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
    models
  };
};
