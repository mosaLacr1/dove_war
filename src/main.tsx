import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少 #root 挂载点');

createRoot(root).render(<App />);
