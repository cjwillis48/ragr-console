// Widget bundle entry point.
//
// This file is the single entry for vite.widget.config.ts. Its job is to
// register the <ragr-chat> custom element on module load. Everything else
// is lazy — the Preact tree only mounts when an element is connected.
import { RagrChatElement } from './element';

if (typeof customElements !== 'undefined' && !customElements.get('ragr-chat')) {
	customElements.define('ragr-chat', RagrChatElement);
}

export { RagrChatElement };
