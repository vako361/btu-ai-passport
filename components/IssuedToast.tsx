'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

export function IssuedToast() {
  useEffect(() => {
    toast.success('Credential issued and verified.');
  }, []);

  return null;
}