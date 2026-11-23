export const EDITOR_STATE_KEY = 'eventEditorState';

export function loadEditorState() {
  try {
    return JSON.parse(sessionStorage.getItem(EDITOR_STATE_KEY));
  } catch {
    return null;
  }
}

export function saveEditorState(state) {
  try {
    sessionStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearEditorSession() {
  try {
    sessionStorage.removeItem(EDITOR_STATE_KEY);
    sessionStorage.removeItem('eventCode');
  } catch {
    /* ignore */
  }
}
