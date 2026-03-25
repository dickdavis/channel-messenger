<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'

  let { children } = $props()

  onMount(() => {
    if (browser && 'serviceWorker' in navigator && !import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister()
        })
      })
    }

    if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/service-worker.js').catch((error) => {
        console.error('Service worker registration failed:', error)
      })
    }
  })
</script>

<svelte:head>
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#4f46e5" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Channel" />
</svelte:head>

{@render children()}
