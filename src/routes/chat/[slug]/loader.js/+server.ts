import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const slug = params.slug;
	const origin = url.origin;
	const embedUrl = `${origin}/chat/${slug}/embed`;
	const safeSlug = JSON.stringify(slug);

	const js = `(function(){
  function init(){
    if(document.querySelector('iframe[data-ragr-widget='+${safeSlug}+']'))return;
    var f=document.createElement('iframe');
    f.src=${JSON.stringify(embedUrl)};
    f.setAttribute('data-ragr-widget',${safeSlug});
    f.title='Chat Widget';
    f.sandbox='allow-scripts allow-same-origin allow-forms allow-popups';
    f.allow='clipboard-write';
    f.style.cssText='position:fixed;bottom:0;right:0;width:80px;height:80px;border:none;z-index:9999;background:transparent;color-scheme:normal;';
    document.body.appendChild(f);
    window.addEventListener('message',function(e){
      if(!e.data||e.data.type!=='ragr-widget-resize')return;
      try{if(e.source!==f.contentWindow)return;}catch(_){}
      f.style.width=e.data.width+'px';
      f.style.height=e.data.height+'px';
    });
  }
  if(document.body)init();
  else document.addEventListener('DOMContentLoaded',init);
})();`;

	return new Response(js, {
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=300, s-maxage=3600'
		}
	});
};
