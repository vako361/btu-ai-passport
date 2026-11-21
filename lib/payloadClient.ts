import { cache } from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';

/** Resolves the Payload instance once per server request, however many components ask for it. */
export const getRequestPayload = cache(() => getPayload({ config }));
