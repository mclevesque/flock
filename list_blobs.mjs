import { list } from '@vercel/blob';
// Check ALL blobs (no prefix filter)
const r = await list({ token: 'vercel_blob_rw_PmPe2PmL9DluO7Ww_xsZTRs9EIxzW4gGv2NdYtrVhWJOuFN' });
console.log('Total blobs:', r.blobs.length);
console.log(JSON.stringify(r.blobs.map(b => ({ path: b.pathname, url: b.url, uploaded: b.uploadedAt })), null, 2));
