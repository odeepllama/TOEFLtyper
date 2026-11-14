<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from './lib/settings.svelte';
  import Home from './routes/Home.svelte';
  import Typing from './routes/Typing.svelte';
  import Stats from './routes/Stats.svelte';
  import Exam from './routes/Exam.svelte';

  const parse = () => location.hash.replace(/^#/, '') || '/';
  let route = $state(parse());

  onMount(() => {
    const on = () => (route = parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  });

  const top = $derived('/' + (route.split('/')[1] ?? ''));
  // The exam runs full-screen like the real test, so the site header is hidden there.
  const examActive = $derived(route.startsWith('/exam/run'));

  const themes = ['dark', 'light', 'sepia'] as const;
  function cycleTheme() {
    settings.theme = themes[(themes.indexOf(settings.theme) + 1) % themes.length];
  }
</script>

{#if !examActive}
  <header class="site">
    <a class="logo" href="#/">
      <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"
        ><rect x="6" y="16" width="52" height="32" rx="6" fill="none" stroke="currentColor" stroke-width="4" /><g
          fill="currentColor"
          ><rect x="14" y="24" width="6" height="6" rx="1" /><rect x="24" y="24" width="6" height="6" rx="1" /><rect
            x="34"
            y="24"
            width="6"
            height="6"
            rx="1"
          /><rect x="44" y="24" width="6" height="6" rx="1" /><rect x="18" y="35" width="28" height="6" rx="1" /></g
        ></svg
      >
      <span>TOEFL<b>typer</b></span>
    </a>
    <nav>
      <a href="#/type" class:active={top === '/type'}>Type</a>
      <a href="#/exam" class:active={top === '/exam'}>TOEFL Practice</a>
      <a href="#/stats" class:active={top === '/stats'}>Stats</a>
      <button class="theme" onclick={cycleTheme} title="Theme: {settings.theme}" aria-label="Change theme">
        {#if settings.theme === 'dark'}☾{:else if settings.theme === 'light'}☀{:else}❦{/if}
      </button>
    </nav>
  </header>
{/if}

<main class:full={examActive}>
  {#if top === '/type'}
    <Typing />
  {:else if top === '/stats'}
    <Stats />
  {:else if top === '/exam'}
    <Exam {route} />
  {:else}
    <Home />
  {/if}
</main>

<style>
  header.site {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.25rem 1.5rem;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    color: var(--accent);
    font-size: 1.35rem;
    letter-spacing: -0.02em;
  }
  .logo span {
    color: var(--text);
    font-weight: 500;
  }
  .logo b {
    color: var(--accent);
    font-weight: 700;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  nav a {
    color: var(--sub);
    text-decoration: none;
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
  }
  nav a:hover {
    color: var(--text);
  }
  nav a.active {
    color: var(--text);
    background: var(--bg-3);
  }
  .theme {
    background: none;
    border: none;
    color: var(--sub);
    font-size: 1.15rem;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 8px;
  }
  .theme:hover {
    color: var(--accent);
  }
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 1.5rem 3rem;
  }
  main.full {
    max-width: none;
    padding: 0;
  }
  @media (max-width: 640px) {
    header.site {
      flex-direction: column;
      gap: 0.75rem;
    }
  }
</style>

