import { File, UploadType } from 'expo-file-system';

export type PutFileResult = { status: number; body: string };

/** Native: streams the picked file from disk (no JS Blob copy). */
export async function putFile(url: string, localUri: string, contentType: string): Promise<PutFileResult> {
  const result = await new File(localUri).upload(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  return { status: result.status, body: result.body };
}
