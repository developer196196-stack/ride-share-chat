export type PutFileResult = { status: number; body: string };

/** Web: the picker returns a blob:/data: URI, so read it and PUT the bytes. */
export async function putFile(url: string, localUri: string, contentType: string): Promise<PutFileResult> {
  const blob = await (await fetch(localUri)).blob();
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  return { status: res.status, body: await res.text() };
}
