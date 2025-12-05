export async function fetchGist(id, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { headers });
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.message || '';
    } catch {}
    throw new Error(`HTTP ${res.status} ${msg}`.trim());
  }
  return res.json();
}

export async function updateGist(id, token, files, description) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    Authorization: `token ${token}`,
  };
  const body = { files };
  if (description) body.description = description;

  const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.message || '';
    } catch {}
    throw new Error(`HTTP ${res.status} ${msg}`.trim());
  }
  return res.json();
}

export async function getGistFileContent(fileObj) {
  if (fileObj.truncated && fileObj.raw_url) {
    const res = await fetch(fileObj.raw_url);
    if (!res.ok) {
      throw new Error(`Raw fetch failed: HTTP ${res.status}`);
    }
    return res.text();
  }
  return fileObj.content || '';
}
