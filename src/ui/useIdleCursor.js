import { useEffect } from 'react'

// In fullscreen, hide the cursor after a couple of still seconds so nothing
// sits on top of the artwork.
export function useIdleCursor(ref, ms = 2200) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer
    const wake = () => {
      el.classList.remove('idle')
      clearTimeout(timer)
      if (document.fullscreenElement === el) timer = setTimeout(() => el.classList.add('idle'), ms)
    }
    el.addEventListener('pointermove', wake)
    document.addEventListener('fullscreenchange', wake)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('pointermove', wake)
      document.removeEventListener('fullscreenchange', wake)
    }
  }, [ref, ms])
}
