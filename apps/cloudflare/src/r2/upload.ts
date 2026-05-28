export function generateR2Key(roomCode: string, type: string, filename: string, uuid: string): string {
  return `rooms/${roomCode}/${type}/${uuid}-${filename}`
}

export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | ReadableStream,
  contentType: string,
  mediaPublicUrl: string
): Promise<string> {
  await bucket.put(key, data, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
  })
  return `${mediaPublicUrl}/${key}`
}
