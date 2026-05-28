export async function deleteFromR2(
  bucket: R2Bucket,
  url: string,
  mediaPublicUrl: string
): Promise<void> {
  const key = url.replace(`${mediaPublicUrl}/`, '')
  await bucket.delete(key)

  // Also attempt to delete a thumbnail sibling at rooms/.../thumbs/...
  const thumbKey = key.replace(/\/([^/]+)$/, '/thumbs/$1')
  await bucket.delete(thumbKey).catch(() => {})
}
