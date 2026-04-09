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
    var scrollPos;
    window.addEventListener('message',function(e){
      if(!e.data)return;
      try{if(e.source!==f.contentWindow)return;}catch(_){}
      if(e.data.type==='ragr-widget-resize'){
        f.style.width=Math.min(e.data.width,window.innerWidth)+'px';
        f.style.height=Math.min(e.data.height,window.innerHeight)+'px';
      }else if(e.data.type==='ragr-widget-scroll-lock'){
        scrollPos=window.scrollY;
        window.addEventListener('scroll',lockScroll);
      }else if(e.data.type==='ragr-widget-scroll-unlock'){
        window.removeEventListener('scroll',lockScroll);
      }
    });
    function lockScroll(){window.scrollTo(0,scrollPos);}
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
