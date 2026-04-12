import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

// Loader script served at /chat/{slug}/loader.js. Customer sites include
// this with a single <script> tag:
//
//   <script src="https://app.ragr.ai/chat/my-model/loader.js" async></script>
//
// The loader is intentionally tiny: it dynamically imports the real widget
// bundle (/widget/ragr-chat.js) once per page and mounts a <ragr-chat>
// element for the requested slug. De-duplication is handled via
// data-ragr-slug (per-element) and data-ragr-bundle (per-script) markers so
// two loaders for the same slug — or several slugs on the same page — only
// load the bundle once and only mount each element once.
//
// The old implementation injected an iframe and negotiated size via
// postMessage. That caused most of the jank that motivated the rebuild.
// This new version eliminates the iframe entirely; the <ragr-chat> custom
// element lives directly in the customer's page with a shadow root for
// CSS isolation.
//
// PUBLIC_WIDGET_SHA is set at deploy time to pin customers to an immutable
// versioned bundle URL (matches what scripts/hash-widget.mjs copies). When
// unset (local dev), we serve the unversioned /widget/ragr-chat.js.
const WIDGET_SHA = env.PUBLIC_WIDGET_SHA || '';

export const GET: RequestHandler = ({ params, url }) => {
	const slug = params.slug;
	const origin = url.origin;
	const bundleUrl = WIDGET_SHA
		? `${origin}/widget/ragr-chat.${WIDGET_SHA}.js`
		: `${origin}/widget/ragr-chat.js`;
	const safeSlug = JSON.stringify(slug);
	const safeBundle = JSON.stringify(bundleUrl);

	const js = `(function(){
var S=${safeSlug},B=${safeBundle};
function mount(){
  if(document.querySelector('ragr-chat[data-ragr-slug='+JSON.stringify(S)+']'))return;
  var el=document.createElement('ragr-chat');
  el.setAttribute('slug',S);
  el.setAttribute('data-ragr-slug',S);
  document.body.appendChild(el);
}
function load(){
  if(window.customElements&&customElements.get('ragr-chat'))return mount();
  if(document.querySelector('script[data-ragr-bundle]')){
    var existing=document.querySelector('script[data-ragr-bundle]');
    existing.addEventListener('load',mount);
    return;
  }
  var s=document.createElement('script');
  s.src=B;s.async=true;s.setAttribute('data-ragr-bundle','1');
  s.addEventListener('load',mount);
  s.addEventListener('error',function(){console.warn('[ragr] widget bundle failed to load')});
  document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);
else load();
})();`;

	return new Response(js, {
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=300',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
