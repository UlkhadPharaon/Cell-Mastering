import { App } from './app/App';

const host = document.getElementById('app');
if (!host) throw new Error('#app mount missing');
host.style.position = 'fixed';
host.style.inset = '0';

const app = new App(host);
(window as unknown as { __cell: App }).__cell = app;
