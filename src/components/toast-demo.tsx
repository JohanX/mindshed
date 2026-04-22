'use client'

import { Button } from '@/components/ui/button'
import { showSuccessToast, showErrorToast } from '@/lib/toast'

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => showSuccessToast('Hobby created')}>Success Toast</Button>
      <Button variant="destructive" onClick={() => showErrorToast('Upload failed — try again')}>
        Error Toast
      </Button>
    </div>
  )
}
